/**
 * Google reviews for the Madex business profile, read from the Places API (New).
 * Only 4- and 5-star reviews with text are shown. Results are cached by Next's
 * fetch cache (6 h); without GOOGLE_PLACES_API_KEY / GOOGLE_PLACE_ID the site
 * falls back to the curated testimonials.
 *
 * Google returns at most five reviews per place and requires the author's name
 * and a link to their profile to be shown, plus Google as the source.
 */

export type GoogleReview = {
  author: string;
  authorUrl?: string;
  photo?: string;
  rating: number;
  text: string;
  when: string;
  publishTime?: string;
};

export type GoogleReviewSummary = {
  rating: number;
  count: number;
  mapsUrl?: string;
  reviews: GoogleReview[];
};

type PlacesResponse = {
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string;
  reviews?: {
    rating?: number;
    relativePublishTimeDescription?: string;
    publishTime?: string;
    text?: { text?: string };
    originalText?: { text?: string };
    authorAttribution?: { displayName?: string; uri?: string; photoUri?: string };
  }[];
};

const REVALIDATE_SECONDS = 6 * 60 * 60;

export async function getGoogleReviews(): Promise<GoogleReviewSummary | null> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  const placeId = process.env.GOOGLE_PLACE_ID;
  if (!key || !placeId) return null;

  try {
    const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=de&regionCode=CH`, {
      headers: {
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "rating,userRatingCount,googleMapsUri,reviews",
      },
      next: { revalidate: REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      console.warn(`[google-reviews] Places API antwortet mit ${res.status}`);
      return null;
    }
    const data = (await res.json()) as PlacesResponse;
    const reviews = (data.reviews ?? [])
      .map((r) => ({
        author: r.authorAttribution?.displayName?.trim() || "Google-Nutzer",
        authorUrl: r.authorAttribution?.uri,
        photo: r.authorAttribution?.photoUri,
        rating: r.rating ?? 0,
        // prefer the text in its original language (usually German)
        text: (r.originalText?.text || r.text?.text || "").trim(),
        when: r.relativePublishTimeDescription ?? "",
        publishTime: r.publishTime,
      }))
      .filter((r) => r.rating >= 4 && r.text.length > 0)
      .sort((a, b) => b.rating - a.rating || (b.publishTime ?? "").localeCompare(a.publishTime ?? ""));

    if (!reviews.length) return null;
    return { rating: data.rating ?? 0, count: data.userRatingCount ?? 0, mapsUrl: data.googleMapsUri, reviews };
  } catch (err) {
    console.warn("[google-reviews] Abruf fehlgeschlagen:", err instanceof Error ? err.message : err);
    return null;
  }
}
