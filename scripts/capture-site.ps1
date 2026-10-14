param(
    [string]$SiteRoot = "https://madex-it.ch",
    [string]$KitRoot = (Split-Path -Parent $PSScriptRoot),
    [int]$ThrottleLimit = 12
)

$ErrorActionPreference = "Stop"
$collectionDate = "2026-10-14"
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)

$archiveRoot = Join-Path $KitRoot "archive"
$sitemapRoot = Join-Path $archiveRoot "sitemaps"
$pageRoot = Join-Path $archiveRoot "pages"
$mediaRoot = Join-Path $KitRoot "assets\all"
$dataRoot = Join-Path $KitRoot "data"

@($archiveRoot, $sitemapRoot, $pageRoot, $mediaRoot, $dataRoot) | ForEach-Object {
    New-Item -ItemType Directory -Force -Path $_ | Out-Null
}

function Write-Utf8File {
    param([string]$Path, [string]$Content)
    $parent = Split-Path -Parent $Path
    if ($parent) { New-Item -ItemType Directory -Force -Path $parent | Out-Null }
    [System.IO.File]::WriteAllText($Path, $Content, $utf8NoBom)
}

function Get-CdataValue {
    param([string]$Text, [string]$Tag)
    $match = [regex]::Match($Text, "<$Tag>\s*<!\[CDATA\[(.*?)\]\]>\s*</$Tag>", "Singleline")
    if ($match.Success) { return $match.Groups[1].Value.Trim() }
    $match = [regex]::Match($Text, "<$Tag>(.*?)</$Tag>", "Singleline")
    if ($match.Success) { return [System.Net.WebUtility]::HtmlDecode($match.Groups[1].Value.Trim()) }
    return $null
}

function Get-PageFileName {
    param([string]$Url, [int]$Index)
    $uri = [Uri]$Url
    $slug = [Uri]::UnescapeDataString($uri.AbsolutePath.Trim("/"))
    if (-not $slug) { $slug = "home" }
    $slug = $slug -replace "/", "__"
    $slug = $slug -replace '[<>:"|?*]', "_"
    if ($slug.Length -gt 150) { $slug = $slug.Substring(0, 150) }
    return ("{0:D3}-{1}.html" -f $Index, $slug)
}

function Get-MediaUrlsFromText {
    param([string]$Text)
    if (-not $Text) { return @() }
    $decoded = [System.Net.WebUtility]::HtmlDecode(($Text -replace '\\/', '/'))
    $pattern = '(?:(?:https?:)?//madex-it\.ch)?/wp-content/uploads/[^"''\s<>()\]]+?\.(?:jpe?g|png|gif|webp|svg|avif|bmp|tiff?|ico|mp4|webm|mov)(?:\?[^"''\s<>()\]]*)?'
    $values = foreach ($match in [regex]::Matches($decoded, $pattern, "IgnoreCase")) {
        $value = $match.Value
        if ($value.StartsWith("//")) { $value = "https:$value" }
        elseif ($value.StartsWith("/")) { $value = "$SiteRoot$value" }
        $value = $value -replace '&amp;', '&'
        $value = ($value -split '\?')[0]
        $value.TrimEnd('.', ',', ';')
    }
    return @($values | Sort-Object -Unique)
}

Write-Output "Fetching sitemap index"
$sitemapIndexUrl = "$SiteRoot/sitemap_index.xml"
$sitemapIndex = (Invoke-WebRequest -Uri $sitemapIndexUrl -UseBasicParsing -TimeoutSec 60).Content
Write-Utf8File -Path (Join-Path $sitemapRoot "sitemap_index.xml") -Content $sitemapIndex

$robots = (Invoke-WebRequest -Uri "$SiteRoot/robots.txt" -UseBasicParsing -TimeoutSec 60).Content
Write-Utf8File -Path (Join-Path $archiveRoot "robots.txt") -Content $robots

$childSitemaps = @([regex]::Matches($sitemapIndex, '<loc>\s*<!\[CDATA\[(.*?)\]\]>\s*</loc>', 'Singleline') | ForEach-Object { $_.Groups[1].Value.Trim() })
$records = @()
$sitemapMedia = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)

foreach ($sitemapUrl in $childSitemaps) {
    $mapName = [System.IO.Path]::GetFileName(([Uri]$sitemapUrl).AbsolutePath)
    $type = $mapName -replace '-sitemap\.xml$', ''
    Write-Output "Fetching $mapName"
    $xml = (Invoke-WebRequest -Uri $sitemapUrl -UseBasicParsing -TimeoutSec 60).Content
    Write-Utf8File -Path (Join-Path $sitemapRoot $mapName) -Content $xml
    foreach ($block in [regex]::Matches($xml, '<url>(.*?)</url>', 'Singleline')) {
        $inner = $block.Groups[1].Value
        $url = Get-CdataValue -Text $inner -Tag 'loc'
        $lastModified = Get-CdataValue -Text $inner -Tag 'lastmod'
        $images = @([regex]::Matches($inner, '<image:loc>\s*<!\[CDATA\[(.*?)\]\]>\s*</image:loc>', 'Singleline') | ForEach-Object { $_.Groups[1].Value.Trim() })
        foreach ($imageUrl in $images) { $null = $sitemapMedia.Add($imageUrl) }
        $records += [pscustomobject][ordered]@{
            type = $type
            url = $url
            lastModified = $lastModified
            imageUrls = $images
            sourceSitemap = $sitemapUrl
        }
    }
}

Write-Output "Fetching WordPress page and post content"
$restCollections = @()
foreach ($restType in @('pages', 'posts')) {
    $apiUrl = "$SiteRoot/wp-json/wp/v2/$restType`?per_page=100&_fields=id,date,modified,slug,status,link,title,excerpt,content,featured_media"
    $response = Invoke-WebRequest -Uri $apiUrl -UseBasicParsing -TimeoutSec 120
    $items = @($response.Content | ConvertFrom-Json)
    foreach ($item in $items) {
        $restCollections += [ordered]@{
            type = $restType.TrimEnd('s')
            id = $item.id
            date = $item.date
            modified = $item.modified
            slug = $item.slug
            status = $item.status
            link = $item.link
            titleHtml = $item.title.rendered
            excerptHtml = $item.excerpt.rendered
            contentHtml = $item.content.rendered
            featuredMediaId = $item.featured_media
        }
        if (-not ($records.url -contains $item.link)) {
            $records += [pscustomobject][ordered]@{
                type = $restType.TrimEnd('s')
                url = $item.link
                lastModified = $item.modified
                imageUrls = @()
                sourceSitemap = $null
                discovery = 'WordPress REST API'
            }
        }
    }
}

$siteContent = [ordered]@{
    generatedAt = $collectionDate
    source = "$SiteRoot/wp-json/wp/v2/"
    count = $restCollections.Count
    records = $restCollections
}
Write-Utf8File -Path (Join-Path $dataRoot "site-content.json") -Content ($siteContent | ConvertTo-Json -Depth 12)

$uniqueRecords = @($records | Group-Object url | ForEach-Object { $_.Group[0] } | Sort-Object type, url)
$downloadPlan = @()
$counter = 0
foreach ($record in $uniqueRecords) {
    $counter++
    $typeFolder = if ($record.type) { $record.type } else { 'other' }
    $fileName = Get-PageFileName -Url $record.url -Index $counter
    $relativePath = "archive/pages/$typeFolder/$fileName"
    $localPath = Join-Path $KitRoot ($relativePath -replace '/', '\')
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $localPath) | Out-Null
    $downloadPlan += [pscustomobject]@{
        Type = $record.type
        Url = $record.url
        LastModified = $record.lastModified
        RelativePath = $relativePath
        LocalPath = $localPath
    }
}

Write-Output "Downloading $($downloadPlan.Count) public pages"
$pageResults = $downloadPlan | ForEach-Object -Parallel {
    $item = $_
    $result = [ordered]@{
        type = $item.Type
        url = $item.Url
        lastModified = $item.LastModified
        localPath = $item.RelativePath
        status = 'failed'
        httpStatus = $null
        bytes = 0
        title = $null
        error = $null
    }
    try {
        $response = Invoke-WebRequest -Uri $item.Url -UseBasicParsing -TimeoutSec 120
        [System.IO.File]::WriteAllText($item.LocalPath, $response.Content, [System.Text.UTF8Encoding]::new($false))
        $titleMatch = [regex]::Match($response.Content, '<title[^>]*>(.*?)</title>', 'IgnoreCase,Singleline')
        $result.status = 'downloaded'
        $result.httpStatus = [int]$response.StatusCode
        $result.bytes = (Get-Item -LiteralPath $item.LocalPath).Length
        if ($titleMatch.Success) { $result.title = [System.Net.WebUtility]::HtmlDecode(([regex]::Replace($titleMatch.Groups[1].Value, '\s+', ' ')).Trim()) }
    } catch {
        $result.error = $_.Exception.Message
        if ($_.Exception.Response -and $_.Exception.Response.StatusCode) { $result.httpStatus = [int]$_.Exception.Response.StatusCode }
    }
    [pscustomobject]$result
} -ThrottleLimit $ThrottleLimit

$pageTextMedia = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
$elementorCssUrls = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
foreach ($page in $pageResults) {
    if ($page.status -ne 'downloaded') { continue }
    $localPath = Join-Path $KitRoot ($page.localPath -replace '/', '\')
    $html = Get-Content -Raw -LiteralPath $localPath
    foreach ($url in (Get-MediaUrlsFromText -Text $html)) { $null = $pageTextMedia.Add($url) }
    $decoded = [System.Net.WebUtility]::HtmlDecode(($html -replace '\\/', '/'))
    foreach ($match in [regex]::Matches($decoded, 'https://madex-it\.ch/wp-content/uploads/elementor/css/[^"''\s<>]+\.css(?:\?[^"''\s<>]*)?', 'IgnoreCase')) {
        $null = $elementorCssUrls.Add($match.Value)
    }
}

Write-Output "Inspecting $($elementorCssUrls.Count) Elementor stylesheets for background media"
$cssMedia = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
foreach ($cssUrl in $elementorCssUrls) {
    try {
        $css = (Invoke-WebRequest -Uri $cssUrl -UseBasicParsing -TimeoutSec 60).Content
        foreach ($url in (Get-MediaUrlsFromText -Text $css)) { $null = $cssMedia.Add($url) }
    } catch {
        Write-Warning "Could not inspect stylesheet: $cssUrl"
    }
}

$allMedia = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
foreach ($url in $sitemapMedia) { $null = $allMedia.Add($url) }
foreach ($url in $pageTextMedia) { $null = $allMedia.Add($url) }
foreach ($url in $cssMedia) { $null = $allMedia.Add($url) }

$mediaPlan = @()
foreach ($url in ($allMedia | Sort-Object)) {
    try {
        $uri = [Uri]$url
        $relative = [Uri]::UnescapeDataString($uri.AbsolutePath) -replace '^/wp-content/uploads/', ''
        $segments = $relative -split '/'
        $safeSegments = foreach ($segment in $segments) { $segment -replace '[<>:"|?*]', '_' }
        $relative = ($safeSegments -join '/')
        $localRelative = "assets/all/$relative"
        $localPath = Join-Path $KitRoot ($localRelative -replace '/', '\')
        $mediaPlan += [pscustomobject]@{
            Url = $url
            LocalPath = $localPath
            RelativePath = $localRelative
            FromSitemap = $sitemapMedia.Contains($url)
            FromPageHtml = $pageTextMedia.Contains($url)
            FromElementorCss = $cssMedia.Contains($url)
        }
    } catch {
        Write-Warning "Skipped malformed media URL: $url"
    }
}

Write-Output "Downloading $($mediaPlan.Count) unique public media files"
$mediaResults = $mediaPlan | ForEach-Object -Parallel {
    $item = $_
    $result = [ordered]@{
        url = $item.Url
        localPath = $item.RelativePath
        fromSitemap = $item.FromSitemap
        fromPageHtml = $item.FromPageHtml
        fromElementorCss = $item.FromElementorCss
        status = 'failed'
        httpStatus = $null
        contentType = $null
        bytes = 0
        sha256 = $null
        error = $null
    }
    try {
        $parent = Split-Path -Parent $item.LocalPath
        New-Item -ItemType Directory -Force -Path $parent | Out-Null
        if (-not (Test-Path -LiteralPath $item.LocalPath) -or (Get-Item -LiteralPath $item.LocalPath).Length -eq 0) {
            $response = Invoke-WebRequest -Uri $item.Url -UseBasicParsing -TimeoutSec 180 -OutFile $item.LocalPath -PassThru
            $result.httpStatus = [int]$response.StatusCode
            $result.contentType = $response.Headers['Content-Type']
            $result.status = 'downloaded'
        } else {
            $result.status = 'already_present'
            $result.httpStatus = 200
        }
        $file = Get-Item -LiteralPath $item.LocalPath
        $result.bytes = $file.Length
        $result.sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $item.LocalPath).Hash
    } catch {
        $result.error = $_.Exception.Message
        if ($_.Exception.Response -and $_.Exception.Response.StatusCode) { $result.httpStatus = [int]$_.Exception.Response.StatusCode }
    }
    [pscustomobject]$result
} -ThrottleLimit $ThrottleLimit

$inventoryRecords = foreach ($record in $uniqueRecords) {
    $pageResult = $pageResults | Where-Object url -eq $record.url | Select-Object -First 1
    [ordered]@{
        type = $record.type
        url = $record.url
        lastModified = $record.lastModified
        imageUrls = @($record.imageUrls)
        sourceSitemap = $record.sourceSitemap
        archive = if ($pageResult) { [ordered]@{ localPath = $pageResult.localPath; status = $pageResult.status; httpStatus = $pageResult.httpStatus; bytes = $pageResult.bytes; title = $pageResult.title; error = $pageResult.error } } else { $null }
    }
}

$siteInventory = [ordered]@{
    generatedAt = $collectionDate
    sourceSitemaps = $childSitemaps
    counts = [ordered]@{
        urls = $inventoryRecords.Count
        pages = @($inventoryRecords | Where-Object type -eq 'page').Count
        posts = @($inventoryRecords | Where-Object type -eq 'post').Count
        categories = @($inventoryRecords | Where-Object type -eq 'category').Count
        tags = @($inventoryRecords | Where-Object type -eq 'post_tag').Count
        archivedSuccessfully = @($pageResults | Where-Object status -eq 'downloaded').Count
        archiveFailures = @($pageResults | Where-Object status -eq 'failed').Count
        sitemapImageReferences = @($records.imageUrls).Count
        sitemapUniqueImageUrls = $sitemapMedia.Count
        discoveredUniqueMediaUrls = $allMedia.Count
    }
    records = $inventoryRecords
}
Write-Utf8File -Path (Join-Path $dataRoot "site-inventory.json") -Content ($siteInventory | ConvertTo-Json -Depth 12)

$mediaInventory = [ordered]@{
    generatedAt = $collectionDate
    site = $SiteRoot
    scope = 'Public media referenced by indexed pages/posts, their rendered HTML, and Elementor upload stylesheets.'
    counts = [ordered]@{
        discovered = $mediaResults.Count
        successful = @($mediaResults | Where-Object status -in @('downloaded', 'already_present')).Count
        failed = @($mediaResults | Where-Object status -eq 'failed').Count
        bytes = ($mediaResults | Where-Object status -in @('downloaded', 'already_present') | Measure-Object bytes -Sum).Sum
        uniqueHashes = @($mediaResults | Where-Object sha256 | Select-Object -ExpandProperty sha256 -Unique).Count
    }
    records = @($mediaResults | Sort-Object url)
}
Write-Utf8File -Path (Join-Path $dataRoot "media-inventory.json") -Content ($mediaInventory | ConvertTo-Json -Depth 8)

$pageManifest = [ordered]@{
    generatedAt = $collectionDate
    counts = [ordered]@{
        attempted = $pageResults.Count
        successful = @($pageResults | Where-Object status -eq 'downloaded').Count
        failed = @($pageResults | Where-Object status -eq 'failed').Count
        bytes = ($pageResults | Where-Object status -eq 'downloaded' | Measure-Object bytes -Sum).Sum
    }
    records = @($pageResults | Sort-Object type, url)
}
Write-Utf8File -Path (Join-Path $dataRoot "page-archive.json") -Content ($pageManifest | ConvertTo-Json -Depth 8)

$summary = [ordered]@{
    pagesAttempted = $pageResults.Count
    pagesSuccessful = @($pageResults | Where-Object status -eq 'downloaded').Count
    pageFailures = @($pageResults | Where-Object status -eq 'failed').Count
    mediaDiscovered = $mediaResults.Count
    mediaSuccessful = @($mediaResults | Where-Object status -in @('downloaded', 'already_present')).Count
    mediaFailures = @($mediaResults | Where-Object status -eq 'failed').Count
    mediaBytes = ($mediaResults | Where-Object status -in @('downloaded', 'already_present') | Measure-Object bytes -Sum).Sum
}

Write-Output "Capture complete"
$summary | Format-List

