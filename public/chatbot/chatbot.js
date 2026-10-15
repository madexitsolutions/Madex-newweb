/**
 * Madex AI Chatbot - customer-facing experience.
 *
 * All server content is inserted with text nodes. Links in AI messages are
 * limited to HTTP(S), opened in a new tab, and protected with noopener.
 */
(function ($) {
    'use strict';

    var config = window.madexChatbot || {};
    var SESSION_KEY = 'madex_chat_session';
    var TOKEN_KEY = 'madex_chat_session_token';
    var OPEN_KEY = 'madex_chat_open';
    var PRIVACY_KEY = 'madex_chat_privacy_ack';
    var TEASER_KEY = 'madex_chat_teaser_seen';
    var HISTORY_KEY = 'madex_chat_history';
    var VIEW_KEY = 'madex_chat_view';
    var HISTORY_LIMIT = 5;
    var session = { id: '', token: '' };
    var startRequest = null;

    function readStorage(key) {
        try {
            return window.localStorage.getItem(key) || '';
        } catch (error) {
            return '';
        }
    }

    function writeStorage(key, value) {
        try {
            window.localStorage.setItem(key, value);
        } catch (error) {
            // The widget remains usable when storage is blocked.
        }
    }

    function removeStorage(key) {
        try {
            window.localStorage.removeItem(key);
        } catch (error) {
            // Nothing else to clean up.
        }
    }

    function loadSession() {
        var storedId = readStorage(SESSION_KEY);
        var storedToken = readStorage(TOKEN_KEY);

        // Old numeric-only sessions are intentionally invalid after the
        // public-id/token security upgrade.
        if (!storedId || !storedToken) {
            clearSession();
            return;
        }

        session.id = storedId;
        session.token = storedToken;
    }

    function storeSession(id, token) {
        session.id = String(id || '');
        session.token = String(token || '');
        writeStorage(SESSION_KEY, session.id);
        writeStorage(TOKEN_KEY, session.token);
        rememberSession(session.id, session.token);
    }

    /*
     * Earlier conversations of this browser, newest first, so a visitor can
     * pick one up again from the welcome view.
     */
    function readHistory() {
        var list;
        try {
            list = JSON.parse(readStorage(HISTORY_KEY) || '[]');
        } catch (error) {
            list = [];
        }
        return (Array.isArray(list) ? list : []).filter(function (entry) {
            return entry && typeof entry.id === 'string' && entry.id && typeof entry.token === 'string' && entry.token;
        });
    }

    function writeHistory(list) {
        writeStorage(HISTORY_KEY, JSON.stringify(list.slice(0, HISTORY_LIMIT)));
    }

    function rememberSession(id, token, title) {
        var list = readHistory();
        var entry = null;
        if (!id || !token) {
            return;
        }
        list = list.filter(function (item) {
            if (item.id === id) {
                entry = item;
                return false;
            }
            return true;
        });
        entry = entry || { id: id, title: '' };
        entry.token = token;
        entry.updated = Date.now();
        if (title && !entry.title) {
            entry.title = String(title).replace(/\s+/g, ' ').trim().slice(0, 80);
        }
        list.unshift(entry);
        writeHistory(list);
    }

    function forgetSession(id) {
        writeHistory(readHistory().filter(function (item) {
            return item.id !== id;
        }));
    }

    function clearSession() {
        session.id = '';
        session.token = '';
        removeStorage(SESSION_KEY);
        removeStorage(TOKEN_KEY);
    }

    function sessionPayload() {
        return {
            session_id: session.id,
            session_token: session.token
        };
    }

    function responseMessage(response, fallback) {
        if (response && response.data && response.data.message) {
            return String(response.data.message);
        }
        return fallback;
    }

    function xhrMessage(xhr, fallback) {
        var response = xhr && xhr.responseJSON;
        return responseMessage(response, fallback);
    }

    function invalidSessionResponse(xhr) {
        var data = xhr && xhr.responseJSON && xhr.responseJSON.data;
        var code = data && data.code ? String(data.code) : '';
        return Boolean(
            (xhr && (xhr.status === 401 || xhr.status === 404)) ||
            code === 'invalid_session' ||
            code === 'session_not_found' ||
            code === 'session_expired'
        );
    }

    function ensureSession() {
        var deferred;

        if (session.id && session.token) {
            return $.Deferred().resolve({ credentials: session, messages: null, isNew: false }).promise();
        }

        if (startRequest) {
            return startRequest;
        }

        deferred = $.Deferred();
        startRequest = deferred.promise();

        $.ajax({
            url: config.ajaxUrl,
            type: 'POST',
            dataType: 'json',
            data: {
                action: 'madex_start_session',
                nonce: config.nonce
            }
        }).done(function (response) {
            var data = response && response.data ? response.data : {};

            if (!response || !response.success || !data.session_id || !data.session_token) {
                deferred.reject({
                    responseJSON: response,
                    status: 400,
                    madexMessage: responseMessage(response, 'Die Chat-Sitzung konnte nicht gestartet werden.')
                });
                return;
            }

            storeSession(data.session_id, data.session_token);
            deferred.resolve({
                credentials: session,
                messages: Array.isArray(data.messages) ? data.messages : [],
                isNew: Boolean(data.is_new)
            });
        }).fail(function (xhr) {
            deferred.reject(xhr);
        }).always(function () {
            startRequest = null;
        });

        return deferred.promise();
    }

    function endSession() {
        var credentials = sessionPayload();
        var request;

        if (!credentials.session_id || !credentials.session_token) {
            clearSession();
            return $.Deferred().resolve().promise();
        }

        request = $.ajax({
            url: config.ajaxUrl,
            type: 'POST',
            dataType: 'json',
            data: {
                action: 'madex_close_session',
                nonce: config.nonce,
                session_id: credentials.session_id,
                session_token: credentials.session_token
            }
        });

        request.always(clearSession);
        return request;
    }

    function element(tag, className, text) {
        var node = document.createElement(tag);
        if (className) {
            node.className = className;
        }
        if (typeof text === 'string') {
            node.textContent = text;
        }
        return node;
    }

    function sectionByKey(key) {
        var sections = Array.isArray(config.sections) ? config.sections : [];
        for (var i = 0; i < sections.length; i++) {
            if (sections[i] && sections[i].key === key) {
                return sections[i];
            }
        }
        return null;
    }

    function normaliseText(value) {
        // Headings may break lines with <br>, so spacing is ignored.
        return String(value || '').replace(/\s+/g, '').toLowerCase();
    }

    /* The page element whose heading contains the section's title. */
    function findSectionHeading(section) {
        var wanted = normaliseText(section && section.heading);
        var headings;
        if (!wanted) {
            return null;
        }
        headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
        for (var i = 0; i < headings.length; i++) {
            if (normaliseText(headings[i].textContent).indexOf(wanted) !== -1) {
                return headings[i];
            }
        }
        return null;
    }

    function scrollToSection(section) {
        var target = findSectionHeading(section);
        if (!target) {
            return false;
        }
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return true;
    }

    var ARROW_PATHS = {
        down: 'M12 5v14m-6-6 6 6 6-6',
        right: 'M5 12h14m-6-6 6 6-6 6',
        external: 'M7 17 17 7m-8 0h8v8'
    };

    function inlineLinkButton(label, href, kind) {
        var link = element('a', 'madex-inline-link');
        var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('aria-hidden', 'true');
        path.setAttribute('d', ARROW_PATHS[kind] || ARROW_PATHS.right);
        svg.appendChild(path);
        link.href = href;
        link.appendChild(element('span', '', label));
        link.appendChild(svg);
        return link;
    }

    function sectionLink(section) {
        var onPage = Boolean(findSectionHeading(section));
        var url;
        try {
            url = new URL(section.url || '/', window.location.href);
        } catch (error) {
            return null;
        }
        if (section.heading) {
            url.hash = 'madex-' + section.key;
        }
        var link = inlineLinkButton(section.label || section.key, url.href, onPage ? 'down' : 'right');
        link.setAttribute('data-madex-section', section.key);
        return link;
    }

    function urlLabel(url) {
        var path = url.pathname.replace(/\/+$/, '');
        var last = path.split('/').pop();
        if (!last) {
            return url.hostname.replace(/^www\./, '');
        }
        last = decodeURIComponent(last).replace(/[-_]+/g, ' ');
        return last.charAt(0).toUpperCase() + last.slice(1);
    }

    function urlLink(label, value) {
        var url = new URL(value, window.location.href);
        var link;
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
            return null;
        }
        if (url.origin === window.location.origin) {
            // Same site: stay in this tab; the chat reopens where it was.
            return inlineLinkButton(label || urlLabel(url), url.href, 'right');
        }
        link = inlineLinkButton(label || urlLabel(url), url.href, 'external');
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        return link;
    }

    /*
     * Text with three kinds of links, all shown as small buttons:
     * [[seite:key]] website areas, [Label](url) and bare URLs.
     */
    function appendSafeMessage(container, text) {
        var source = String(text || '');
        var linkPattern = /\[\[seite:([a-z0-9-]+)\]\]|\[([^\]]+)\]\(([^)\s]+)\)|(https?:\/\/[^\s<>()\[\]]*[^\s<>()\[\].,;:!?«»"'])/g;
        var cursor = 0;
        var match;

        function appendText(value) {
            var lines = String(value).split('\n');
            lines.forEach(function (line, index) {
                if (index) {
                    container.appendChild(document.createElement('br'));
                }
                container.appendChild(document.createTextNode(line));
            });
        }

        while ((match = linkPattern.exec(source)) !== null) {
            var link = null;
            appendText(source.slice(cursor, match.index));

            try {
                if (match[1]) {
                    var section = sectionByKey(match[1]);
                    link = section ? sectionLink(section) : null;
                } else {
                    link = urlLink(match[2] || '', match[3] || match[4]);
                }
            } catch (error) {
                link = null;
            }

            if (link) {
                container.appendChild(link);
            } else if (match[2]) {
                appendText(match[2]);
            }

            cursor = linkPattern.lastIndex;
        }

        appendText(source.slice(cursor));
    }

    function randomKey() {
        if (window.crypto && typeof window.crypto.randomUUID === 'function') {
            return window.crypto.randomUUID();
        }

        if (window.crypto && typeof window.crypto.getRandomValues === 'function') {
            var values = new Uint32Array(4);
            window.crypto.getRandomValues(values);
            return Array.prototype.map.call(values, function (value) {
                return value.toString(16).padStart(8, '0');
            }).join('-');
        }

        return 'mdx-' + Date.now() + '-' + Math.random().toString(36).slice(2);
    }

    function localDateValue(date) {
        var pad = function (value) { return String(value).padStart(2, '0'); };
        return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
    }

    function displayDate(value) {
        if (!value) {
            return 'Nicht angegeben';
        }

        var parts = value.split('-');
        if (parts.length !== 3) {
            return value;
        }
        return parts[2] + '.' + parts[1] + '.' + parts[0];
    }

    var SERVICE_LABELS = config.services || {
        'website': 'Neue Website / Webdesign',
        'wartung': 'Website-Betreuung & Hosting',
        'seo': 'SEO – besser gefunden werden',
        'google-ads': 'Google Ads',
        'social-media': 'Social Media Marketing',
        'foto-video': 'Fotos & Werbevideos',
        'grafik': 'Grafikdesign & Logo',
        'analyse': 'Kostenlose Website-Analyse',
        'other': 'Anderes Anliegen'
    };

    function serviceChoices(withPlaceholder) {
        var choices = withPlaceholder ? [['', 'Bitte auswählen']] : [];
        Object.keys(SERVICE_LABELS).forEach(function (key) {
            choices.push([key, SERVICE_LABELS[key]]);
        });
        return choices;
    }

    function readSessionFlag(key) {
        try {
            return window.sessionStorage.getItem(key);
        } catch (error) {
            return null;
        }
    }

    function writeSessionFlag(key, value) {
        try {
            window.sessionStorage.setItem(key, value);
        } catch (error) {
            // Private mode: the greeting may show again on the next page.
        }
    }

    function serviceLabel(key) {
        return SERVICE_LABELS[key] || key || '–';
    }

    function longDate(value) {
        var parts = String(value || '').split('-');
        if (parts.length !== 3) {
            return displayDate(value);
        }
        var date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        var days = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
        var months = ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sept.', 'Okt.', 'Nov.', 'Dez.'];
        return days[date.getDay()] + ', ' + date.getDate() + '. ' + months[date.getMonth()];
    }

    var heartbeatTimer = null;

    function startHeartbeat() {
        if (heartbeatTimer) {
            return;
        }
        // Keeps the dashboard "live" count accurate while the chat is open.
        heartbeatTimer = window.setInterval(function () {
            if (document.hidden || !session.id || !session.token) {
                return;
            }
            var payload = sessionPayload();
            payload.action = 'madex_heartbeat';
            payload.nonce = config.nonce;
            $.ajax({ url: config.ajaxUrl, type: 'POST', dataType: 'json', data: payload }).fail(function (xhr) {
                if (invalidSessionResponse(xhr)) {
                    clearSession();
                }
            });
        }, 60000);
    }

    function stopHeartbeat() {
        window.clearInterval(heartbeatTimer);
        heartbeatTimer = null;
    }

    function normaliseFeatures(pkg) {
        var features = pkg.features || pkg.services || pkg.included_services || pkg.includes || [];
        if (typeof features === 'string') {
            features = features.split(/\r?\n|,/);
        }
        return Array.isArray(features) ? features.map(function (item) { return String(item).trim(); }).filter(Boolean) : [];
    }

    function isFallbackMessage(message, envelope) {
        var source = message || {};
        var data = envelope || {};
        return Boolean(
            source.fallback ||
            source.is_fallback ||
            source.needs_handoff ||
            source.confirmed_information === false ||
            source.knowledge_status === 'unavailable' ||
            data.fallback ||
            data.needs_handoff ||
            data.confirmed_information === false ||
            data.knowledge_status === 'unavailable'
        );
    }

    function activeElementIn(node) {
        // Inside a shadow root document.activeElement is only the host element.
        var rootNode = node && typeof node.getRootNode === 'function' ? node.getRootNode() : document;
        return (rootNode && rootNode.activeElement) || document.activeElement;
    }

    function ChatWidget(root) {
        this.root = root;
        this.$root = $(root);
        this.embedded = this.$root.attr('data-embedded') === 'true';
        this.$window = this.$root.find('[data-madex-window]');
        this.$toggle = this.$root.find('[data-madex-toggle]');
        this.$content = this.$root.find('[data-madex-content]');
        this.$messages = this.$root.find('[data-madex-messages]');
        this.$typing = this.$root.find('[data-madex-typing]');
        this.$inputArea = this.$root.find('[data-madex-input-area]');
        this.$input = this.$root.find('[data-madex-input]');
        this.$send = this.$root.find('[data-madex-send]');
        this.$flowBody = this.$root.find('[data-madex-flow-body]');
        this.$alert = this.$root.find('[data-madex-alert]');
        this.$newMessage = this.$root.find('[data-madex-new-message]');
        this.isOpen = this.embedded;
        this.loading = false;
        this.messagesLoaded = false;
        this.pendingAction = '';
        this.previousFocus = null;
        this.clientStatus = '';
        this.packageInterest = '';
        this.service = '';
        this.appointment = null;
        this.privacyAccepted = readStorage(PRIVACY_KEY) === '1';
        this.bind();
        this.setPrivacyState();

        if (this.embedded) {
            this.$window.prop('hidden', false);
        } else if (readStorage(OPEN_KEY) === 'true') {
            this.open(true);
        } else {
            this.scheduleTeaser();
        }

        this.renderHistory();
        // A visitor who was chatting stays in the conversation on the next page.
        if (this.isOpen && session.id && readStorage(VIEW_KEY) === 'conversation') {
            this.openConversation();
        } else if (this.isOpen && !this.embedded) {
            this.focusWelcome();
        }
    }

    ChatWidget.prototype.bind = function () {
        var self = this;

        this.$toggle.on('click', function () {
            if (self.isOpen) {
                self.close();
            } else {
                self.open();
            }
        });

        this.$root.on('click', '[data-madex-close]', function () {
            self.close();
        });

        this.$root.on('click', '[data-madex-back]', function () {
            self.handleAction('back-home');
        });

        this.$root.on('click', '[data-madex-history-id]', function () {
            self.continueConversation(String($(this).attr('data-madex-history-id') || ''));
        });

        // An area on this page is scrolled into view instead of reloading it.
        this.$root.on('click', '[data-madex-section]', function (event) {
            var section = sectionByKey(String($(this).attr('data-madex-section') || ''));
            if (section && scrollToSection(section)) {
                event.preventDefault();
                if (window.matchMedia && window.matchMedia('(max-width: 600px)').matches) {
                    self.close();
                }
            }
        });

        // The notice sits next to every entry point; choosing one is consent
        // to storing the conversation.
        this.$root.on('click', '[data-madex-action]', function () {
            var action = String($(this).attr('data-madex-action') || '');
            if (!self.privacyAccepted) {
                self.privacyAccepted = true;
                writeStorage(PRIVACY_KEY, '1');
                self.setPrivacyState();
            }
            self.handleAction(action);
        });

        this.$root.on('click', '[data-madex-teaser-open]', function () {
            self.hideTeaser(true);
            self.open();
        });

        this.$root.on('click', '[data-madex-teaser-close]', function () {
            self.hideTeaser(true);
            self.$toggle.trigger('focus');
        });

        this.$root.find('[data-madex-chat-form]').on('submit', function (event) {
            event.preventDefault();
            self.sendCurrentMessage();
        });

        this.$input.on('keydown', function (event) {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                self.$root.find('[data-madex-chat-form]').trigger('submit');
            }
        }).on('input', function () {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 112) + 'px';
        });

        this.$messages.on('scroll', function () {
            if (self.isNearBottom()) {
                self.$newMessage.prop('hidden', true);
            }
        });

        this.$newMessage.on('click', function () {
            self.scrollToBottom(true);
            self.$newMessage.prop('hidden', true);
        });

        this.$window.on('keydown', function (event) {
            if (!self.embedded && event.key === 'Escape') {
                event.preventDefault();
                self.close();
            }
            if (!self.embedded && event.key === 'Tab') {
                self.trapFocus(event);
            }
        });
    };

    ChatWidget.prototype.setPrivacyState = function () {
        this.$root.find('[data-madex-privacy]').toggleClass('is-accepted', this.privacyAccepted);
    };

    /*
     * Proactive greeting: a short message beside the launcher after a delay,
     * once per visit, never while the chat is open or after it was dismissed.
     */
    ChatWidget.prototype.scheduleTeaser = function () {
        var self = this;
        var teaser = config.teaser || {};
        var message = String(teaser.message || '').trim();
        if (this.embedded || !teaser.enabled || !message || readSessionFlag(TEASER_KEY)) {
            return;
        }
        if (!teaser.mobile && window.matchMedia && window.matchMedia('(max-width: 600px)').matches) {
            return;
        }
        this.$root.find('[data-madex-teaser-text]').text(message);
        this.teaserTimer = window.setTimeout(function () {
            if (self.isOpen || readSessionFlag(TEASER_KEY)) {
                return;
            }
            self.$root.find('[data-madex-teaser]').prop('hidden', false).addClass('is-visible');
            self.$root.find('[data-madex-badge]').prop('hidden', false);
            self.$toggle.attr('aria-label', 'Madex Chat öffnen – 1 neue Nachricht');
        }, Math.max(0, Number(teaser.delay) || 0) * 1000);
    };

    ChatWidget.prototype.hideTeaser = function (remember) {
        window.clearTimeout(this.teaserTimer);
        this.$root.find('[data-madex-teaser]').removeClass('is-visible').prop('hidden', true);
        this.$root.find('[data-madex-badge]').prop('hidden', true);
        this.$toggle.attr('aria-label', 'Madex Chat öffnen');
        if (remember) {
            writeSessionFlag(TEASER_KEY, '1');
        }
    };

    ChatWidget.prototype.focusWelcome = function () {
        var self = this;
        window.setTimeout(function () {
            var target = self.$root.find('[data-madex-view="welcome"] h2').get(0);
            if (target && !self.$root.find('[data-madex-view="welcome"]').prop('hidden')) {
                target.focus();
            }
        }, 180);
    };

    ChatWidget.prototype.open = function (restoring) {
        this.previousFocus = activeElementIn(this.root);
        this.isOpen = true;
        this.hideTeaser(true);
        this.$window.prop('hidden', false).addClass('madex-open');
        this.$toggle.attr('aria-expanded', 'true');
        this.$root.addClass('madex-is-open');
        writeStorage(OPEN_KEY, 'true');
        this.fitMobileViewport(true);
        startHeartbeat();
        if (!restoring) {
            this.focusWelcome();
        }
    };

    ChatWidget.prototype.close = function () {
        if (this.embedded) {
            return;
        }
        this.isOpen = false;
        this.$window.removeClass('madex-open').prop('hidden', true);
        this.$toggle.attr('aria-expanded', 'false');
        this.$root.removeClass('madex-is-open');
        writeStorage(OPEN_KEY, 'false');
        this.fitMobileViewport(false);
        stopHeartbeat();
        if (this.previousFocus && typeof this.previousFocus.focus === 'function') {
            this.previousFocus.focus();
        } else {
            this.$toggle.trigger('focus');
        }
    };

    /*
     * Zoom lock while the chat is open on a phone: the page's viewport tag
     * gets maximum-scale=1 (Chrome, Firefox, and focus zoom in Safari) and
     * pinch gestures are cancelled (iOS ignores user-scalable=no). The
     * site's own viewport tag is restored when the chat closes.
     */
    var zoomLock = { active: false, meta: null, created: false, content: '' };

    function blockGesture(event) {
        event.preventDefault();
    }

    function blockPinch(event) {
        if (event.touches && event.touches.length > 1) {
            event.preventDefault();
        }
    }

    function setZoomLock(active) {
        var meta;
        if (active === zoomLock.active) {
            return;
        }
        zoomLock.active = active;
        if (active) {
            meta = document.querySelector('meta[name="viewport"]');
            zoomLock.created = !meta;
            if (!meta) {
                meta = document.createElement('meta');
                meta.name = 'viewport';
                document.head.appendChild(meta);
            }
            zoomLock.meta = meta;
            zoomLock.content = meta.getAttribute('content') || '';
            meta.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover');
            document.addEventListener('gesturestart', blockGesture, { passive: false });
            document.addEventListener('gesturechange', blockGesture, { passive: false });
            document.addEventListener('touchmove', blockPinch, { passive: false });
            return;
        }
        if (zoomLock.meta) {
            if (zoomLock.created) {
                zoomLock.meta.parentNode && zoomLock.meta.parentNode.removeChild(zoomLock.meta);
            } else {
                zoomLock.meta.setAttribute('content', zoomLock.content);
            }
        }
        zoomLock.meta = null;
        document.removeEventListener('gesturestart', blockGesture);
        document.removeEventListener('gesturechange', blockGesture);
        document.removeEventListener('touchmove', blockPinch);
    }

    function isPhone() {
        return Boolean(window.matchMedia && window.matchMedia('(max-width: 599px)').matches);
    }

    /*
     * On phones the chat is full screen. While it is open the page behind it
     * cannot scroll, and the panel follows the visual viewport, so the
     * on-screen keyboard shrinks the chat instead of revealing the page.
     */
    ChatWidget.prototype.fitMobileViewport = function (active) {
        var self = this;
        var win = this.$window.get(0);
        var root = document.documentElement;
        var viewport = window.visualViewport;

        if (this.embedded || !win) {
            return;
        }
        if (!this.onViewportChange) {
            this.onViewportChange = function () {
                if (!self.isOpen || !isPhone()) {
                    win.style.removeProperty('top');
                    win.style.removeProperty('height');
                    return;
                }
                if (viewport) {
                    win.style.setProperty('top', Math.max(0, viewport.offsetTop) + 'px');
                    win.style.setProperty('height', viewport.height + 'px');
                }
            };
        }

        if (active && isPhone()) {
            setZoomLock(true);
            if (!this.scrollLocked) {
                this.scrollLocked = { html: root.style.overflow, body: document.body.style.overflow };
                root.style.overflow = 'hidden';
                document.body.style.overflow = 'hidden';
            }
            if (viewport && !this.viewportBound) {
                viewport.addEventListener('resize', this.onViewportChange);
                viewport.addEventListener('scroll', this.onViewportChange);
                this.viewportBound = true;
            }
            this.onViewportChange();
            return;
        }

        setZoomLock(false);
        if (this.scrollLocked) {
            root.style.overflow = this.scrollLocked.html;
            document.body.style.overflow = this.scrollLocked.body;
            this.scrollLocked = null;
        }
        if (viewport && this.viewportBound) {
            viewport.removeEventListener('resize', this.onViewportChange);
            viewport.removeEventListener('scroll', this.onViewportChange);
            this.viewportBound = false;
        }
        win.style.removeProperty('top');
        win.style.removeProperty('height');
    };

    ChatWidget.prototype.trapFocus = function (event) {
        var focusable = this.$window.find('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])').filter(':visible').toArray();
        if (!focusable.length) {
            return;
        }
        var first = focusable[0];
        var last = focusable[focusable.length - 1];
        var active = activeElementIn(this.root);
        if (event.shiftKey && active === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && active === last) {
            event.preventDefault();
            first.focus();
        }
    };

    ChatWidget.prototype.announce = function (message, error) {
        var self = this;
        this.$alert.text(message).toggleClass('is-error', Boolean(error)).prop('hidden', false);
        window.clearTimeout(this.alertTimer);
        this.alertTimer = window.setTimeout(function () {
            self.$alert.prop('hidden', true);
        }, error ? 8000 : 3500);
    };

    ChatWidget.prototype.showView = function (name, focusSelector) {
        var self = this;
        this.$root.find('[data-madex-view]').each(function () {
            $(this).prop('hidden', $(this).attr('data-madex-view') !== name);
        });
        this.$inputArea.prop('hidden', name !== 'conversation');
        this.$root.find('[data-madex-back]').prop('hidden', name === 'welcome');
        writeStorage(VIEW_KEY, name === 'conversation' ? 'conversation' : 'welcome');
        if (name === 'welcome') {
            this.renderHistory();
        }
        this.$content.scrollTop(0);
        window.setTimeout(function () {
            var target = focusSelector ? self.$root.find(focusSelector).get(0) : null;
            if (target) {
                target.focus();
            }
        }, 20);
    };

    ChatWidget.prototype.handleAction = function (action) {
        switch (action) {
            case 'chat':
                this.openConversation();
                break;
            case 'appointment':
                this.startAppointment();
                break;
            case 'packages':
                this.showPackageQualification();
                break;
            case 'analyse':
                this.service = 'analyse';
                this.startAppointment({ service: 'analyse', message: 'Ich interessiere mich für die kostenlose Website- und Marketing-Analyse.' });
                break;
            case 'contact':
                this.openConversation();
                this.appendContactCard('So erreichen Sie uns direkt:');
                break;
            case 'existing-client':
                this.clientStatus = 'yes';
                this.showClientPath(true);
                break;
            case 'new-client':
                this.clientStatus = 'no';
                this.showClientPath(false);
                break;
            case 'back-home':
                this.showView('welcome', '[data-madex-view="welcome"] h2');
                break;
            case 'new-chat':
                this.resetConversation();
                break;
        }
    };

    ChatWidget.prototype.flowShell = function (title, description) {
        var shell = element('div', 'madex-flow-shell');
        var heading = element('h2', 'madex-flow-title', title);
        heading.tabIndex = -1;
        shell.appendChild(heading);
        if (description) {
            shell.appendChild(element('p', 'madex-flow-description', description));
        }
        return shell;
    };

    ChatWidget.prototype.showClientPath = function (existing) {
        var self = this;
        var shell = this.flowShell(
            existing ? 'Schön, Sie wiederzusehen.' : 'Willkommen bei Madex.',
            existing ? 'Worum geht es bei Ihrem Anliegen?' : 'Wobei dürfen wir Ihr Unternehmen unterstützen?'
        );
        var actions = element('div', 'madex-client-paths');
        var choices = existing ? [
            ['Frage an den Assistenten', 'chat'],
            ['Support oder Rückruf', 'support'],
            ['Termin anfragen', 'appointment'],
            ['Pakete ansehen', 'packages']
        ] : [
            ['Passendes Paket finden', 'packages'],
            ['Kostenlose Website-Analyse anfragen', 'analyse'],
            ['Direkt eine Frage stellen', 'chat'],
            ['Beratungstermin anfragen', 'appointment']
        ];

        choices.forEach(function (choice) {
            var button = element('button', 'madex-choice-button', choice[0]);
            button.type = 'button';
            button.addEventListener('click', function () {
                if (choice[1] === 'support') {
                    self.openConversation('Ich bin bereits Kunde und benötige Unterstützung.');
                } else {
                    self.handleAction(choice[1]);
                }
            });
            actions.appendChild(button);
        });

        shell.appendChild(actions);
        this.$flowBody.empty().append(shell);
        this.showView('flow', '.madex-flow-title');
    };

    ChatWidget.prototype.openConversation = function (prefill) {
        var self = this;
        this.showView('conversation');
        this.$input.prop('disabled', true);
        this.$send.prop('disabled', true);

        if (this.messagesLoaded) {
            this.$input.prop('disabled', false);
            this.$send.prop('disabled', false);
            if (prefill) {
                this.$input.val(prefill);
            }
            this.$input.trigger('focus');
            return;
        }

        this.showTyping();
        ensureSession().done(function (result) {
            if (Array.isArray(result.messages) && result.messages.length) {
                self.$messages.empty();
                result.messages.forEach(function (message) {
                    self.appendMessage(message);
                });
                self.messagesLoaded = true;
                self.finishConversationOpen(prefill);
            } else if (result.isNew) {
                self.appendMessage({
                    sender_type: 'ai',
                    content: config.welcomeMessage || 'Hallo, ich bin Orion, der KI-Assistent von Madex IT Solutions. Wie kann ich Ihnen helfen?'
                });
                self.messagesLoaded = true;
                self.finishConversationOpen(prefill);
            } else {
                self.loadMessages(prefill);
            }
        }).fail(function (xhr) {
            self.hideTyping();
            self.$input.prop('disabled', false);
            self.$send.prop('disabled', false);
            self.announce(xhr.madexMessage || xhrMessage(xhr, 'Verbindung fehlgeschlagen. Bitte versuchen Sie es erneut.'), true);
        });
    };

    ChatWidget.prototype.finishConversationOpen = function (prefill) {
        this.hideTyping();
        this.$input.prop('disabled', false);
        this.$send.prop('disabled', false);
        if (prefill) {
            this.$input.val(prefill);
        }
        this.scrollToBottom(true);
        this.$input.trigger('focus');
    };

    ChatWidget.prototype.loadMessages = function (prefill) {
        var self = this;
        var payload = sessionPayload();
        payload.action = 'madex_get_messages';
        payload.nonce = config.nonce;
        payload.after_id = 0;

        $.ajax({
            url: config.ajaxUrl,
            type: 'POST',
            dataType: 'json',
            data: payload
        }).done(function (response) {
            var messages = response && response.success && response.data && Array.isArray(response.data.messages) ? response.data.messages : [];
            self.$messages.empty();
            messages.forEach(function (message) {
                self.appendMessage(message);
            });
            if (!messages.length) {
                self.appendMessage({ sender_type: 'ai', content: config.welcomeMessage || 'Hallo, ich bin Orion, der KI-Assistent von Madex IT Solutions. Wie kann ich Ihnen helfen?' });
            }
            self.messagesLoaded = true;
            self.finishConversationOpen(prefill);
        }).fail(function (xhr) {
            if (invalidSessionResponse(xhr)) {
                forgetSession(session.id);
                clearSession();
                self.messagesLoaded = false;
                self.openConversation(prefill);
                return;
            }
            self.hideTyping();
            self.$input.prop('disabled', false);
            self.$send.prop('disabled', false);
            self.announce(xhrMessage(xhr, 'Der Chatverlauf konnte nicht geladen werden.'), true);
        });
    };

    ChatWidget.prototype.isNearBottom = function () {
        var node = this.$messages.get(0);
        return !node || node.scrollHeight - node.scrollTop - node.clientHeight < 72;
    };

    ChatWidget.prototype.scrollToBottom = function (force) {
        var node = this.$messages.get(0);
        if (!node || (!force && !this.isNearBottom())) {
            return;
        }
        window.requestAnimationFrame(function () {
            node.scrollTop = node.scrollHeight;
        });
    };

    ChatWidget.prototype.appendMessage = function (message, envelope) {
        var self = this;
        var isUser = message && message.sender_type === 'user';
        var wasNearBottom = this.isNearBottom();
        var item = element('article', 'madex-message ' + (isUser ? 'madex-message-user' : 'madex-message-ai'));
        var label = element('span', 'madex-visually-hidden', isUser ? 'Sie:' : (config.assistantName || 'Orion') + ':');
        var body = element('div', 'madex-message-content');
        var content = String(message && message.content ? message.content : '');

        item.appendChild(label);
        appendSafeMessage(body, content);
        item.appendChild(body);

        if (!isUser && (content.length > 680 || content.split('\n').length > 8)) {
            body.classList.add('is-collapsed');
            var more = element('button', 'madex-message-more', 'Mehr anzeigen');
            more.type = 'button';
            more.addEventListener('click', function () {
                var collapsed = body.classList.toggle('is-collapsed');
                more.textContent = collapsed ? 'Mehr anzeigen' : 'Weniger anzeigen';
                more.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
                self.scrollToBottom(false);
            });
            more.setAttribute('aria-expanded', 'false');
            item.appendChild(more);
        }

        this.$messages.append(item);

        if (isFallbackMessage(message, envelope)) {
            this.appendFallbackActions(message);
        }

        if (wasNearBottom) {
            this.scrollToBottom(true);
        } else {
            this.$newMessage.prop('hidden', false);
        }

        return $(item);
    };

    function contactDetails() {
        var contacts = config.contacts || {};
        var phones = Array.isArray(contacts.phones) ? contacts.phones : [];
        return {
            phones: phones.map(String).filter(Boolean),
            email: contacts.email ? String(contacts.email) : ''
        };
    }

    function telHref(number) {
        // Swiss numbers are shown in local format but dialled internationally.
        var digits = number.replace(/[^\d+]/g, '');
        if (digits.charAt(0) === '0' && digits.charAt(1) !== '0') {
            digits = '+41' + digits.slice(1);
        }
        return 'tel:' + digits;
    }

    var CONTACT_ICONS = {
        phone: 'M6.6 3h3l1.5 4.5-2.2 1.4a11 11 0 0 0 6.2 6.2l1.4-2.2L21 14.4v3A2.6 2.6 0 0 1 18.4 20 15.4 15.4 0 0 1 4 5.6 2.6 2.6 0 0 1 6.6 3Z',
        mail: 'M4 6h16v12H4zM4 7l8 6 8-6'
    };

    function contactLink(href, label, icon) {
        var link = element('a', 'madex-contact-link');
        var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('aria-hidden', 'true');
        path.setAttribute('d', CONTACT_ICONS[icon]);
        svg.appendChild(path);
        link.href = href;
        link.appendChild(svg);
        link.appendChild(element('span', '', label));
        return link;
    }

    /*
     * Escalation: when the assistant has no confirmed answer the visitor gets
     * a direct line to the team (phone and e-mail) next to the appointment
     * request, instead of being left in the chat.
     */
    ChatWidget.prototype.contactList = function () {
        var contacts = contactDetails();
        if (!contacts.phones.length && !contacts.email) {
            return null;
        }
        var list = element('div', 'madex-contact-list');
        list.setAttribute('aria-label', 'Madex direkt kontaktieren');
        contacts.phones.forEach(function (number) {
            list.appendChild(contactLink(telHref(number), number, 'phone'));
        });
        if (contacts.email) {
            list.appendChild(contactLink('mailto:' + contacts.email, contacts.email, 'mail'));
        }
        return list;
    };

    /* Call and e-mail as buttons under an answer. */
    ChatWidget.prototype.contactButtons = function () {
        var contacts = contactDetails();
        var links = [];
        contacts.phones.forEach(function (number) {
            var link = contactLink(telHref(number), number, 'phone');
            link.className = 'madex-suggestion madex-suggestion-contact';
            links.push(link);
        });
        if (contacts.email) {
            var mail = contactLink('mailto:' + contacts.email, 'E-Mail schreiben', 'mail');
            mail.className = 'madex-suggestion madex-suggestion-contact';
            links.push(mail);
        }
        return links;
    };

        ChatWidget.prototype.appendContactCard = function (note) {
        var card = element('aside', 'madex-fallback-card');
        var list = this.contactList();
        card.appendChild(element('p', 'madex-fallback-note', note));
        if (list) {
            card.appendChild(list);
        }
        this.$messages.append(card);
        this.scrollToBottom(true);
    };

    var ACTION_LABELS = {
        pakete: 'Passendes Paket finden',
        termin: 'Termin anfragen',
        analyse: 'Kostenlose Analyse anfragen',
        kontakt: 'Direkt anrufen oder schreiben'
    };

    var ACTION_TARGETS = {
        pakete: 'packages',
        termin: 'appointment',
        analyse: 'analyse',
        kontakt: 'contact'
    };

    /* Next steps the assistant suggested, as buttons under its reply. */
    ChatWidget.prototype.appendSuggestedActions = function (actions) {
        var self = this;
        var known = (Array.isArray(actions) ? actions : []).filter(function (action) {
            return Object.prototype.hasOwnProperty.call(ACTION_LABELS, action);
        });
        if (!known.length) {
            return;
        }
        // Generic next steps move to the latest answer; call and e-mail
        // buttons stay under the answer that offered them.
        this.$messages.find('.madex-suggestions:not(.has-contact)').remove();
        var row = element('div', 'madex-suggestions');
        row.setAttribute('aria-label', 'Vorgeschlagene nächste Schritte');
        known.forEach(function (action) {
            if (action === 'kontakt') {
                row.classList.add('has-contact');
                self.contactButtons().forEach(function (link) {
                    row.appendChild(link);
                });
                return;
            }
            var button = element('button', 'madex-suggestion', ACTION_LABELS[action]);
            button.type = 'button';
            button.addEventListener('click', function () {
                row.parentNode && row.parentNode.removeChild(row);
                if (action === 'kontakt') {
                    self.appendContactCard('So erreichen Sie uns direkt:');
                    return;
                }
                self.handleAction(ACTION_TARGETS[action]);
            });
            row.appendChild(button);
        });
        this.$messages.append(row);
        this.scrollToBottom(true);
    };

    /*
     * Escalation: when the assistant has no confirmed answer the visitor gets
     * a direct line to the team (phone and e-mail) next to the appointment
     * request, instead of being left in the chat.
     */
    ChatWidget.prototype.appendFallbackActions = function (message) {
        var self = this;
        var card = element('aside', 'madex-fallback-card');
        var list = this.contactList();
        var primary = element('button', 'madex-button madex-button-primary madex-fallback-primary', 'Termin anfragen');
        var other = element('button', 'madex-text-action madex-fallback-other', 'Andere Frage stellen');

        card.appendChild(element('p', 'madex-fallback-note', 'Unser Team hilft Ihnen gerne persönlich weiter:'));
        if (list) {
            card.appendChild(list);
        }

        primary.type = 'button';
        primary.addEventListener('click', function () {
            self.handleAction('appointment');
        });
        other.type = 'button';
        other.addEventListener('click', function () {
            self.$input.trigger('focus');
        });
        card.appendChild(primary);
        card.appendChild(other);

        this.$messages.append(card);
        this.$root.trigger('madex:fallback', [message]);
    };

    ChatWidget.prototype.showTyping = function () {
        this.$typing.prop('hidden', false);
    };

    ChatWidget.prototype.hideTyping = function () {
        this.$typing.prop('hidden', true);
    };

    ChatWidget.prototype.sendCurrentMessage = function () {
        var self = this;
        var text = String(this.$input.val() || '').trim();

        if (!text || this.loading) {
            return;
        }

        this.loading = true;
        this.$input.prop('disabled', true);
        this.$send.prop('disabled', true);

        ensureSession().done(function () {
            var optimistic = self.appendMessage({ sender_type: 'user', content: text });
            var payload = sessionPayload();
            payload.action = 'madex_send_message';
            payload.nonce = config.nonce;
            payload.message = text;
            self.$input.val('').css('height', 'auto');
            self.showTyping();

            $.ajax({
                url: config.ajaxUrl,
                type: 'POST',
                dataType: 'json',
                data: payload
            }).done(function (response) {
                var data = response && response.data ? response.data : {};
                self.hideTyping();
                if (!response || !response.success || !data.ai_message) {
                    optimistic.addClass('is-failed').append(element('span', 'madex-message-state', 'Nicht gesendet'));
                    self.announce(responseMessage(response, 'Die Nachricht konnte nicht gesendet werden.'), true);
                    return;
                }
                rememberSession(session.id, session.token, text);
                self.appendMessage(data.ai_message, data);
                if (!isFallbackMessage(data.ai_message, data)) {
                    self.appendSuggestedActions(data.actions);
                }
            }).fail(function (xhr) {
                self.hideTyping();
                optimistic.addClass('is-failed').append(element('span', 'madex-message-state', 'Nicht gesendet'));
                if (invalidSessionResponse(xhr)) {
                    clearSession();
                    self.messagesLoaded = false;
                }
                self.announce(xhrMessage(xhr, 'Verbindungsfehler. Bitte versuchen Sie es erneut.'), true);
            }).always(function () {
                self.loading = false;
                self.$input.prop('disabled', false);
                self.$send.prop('disabled', false);
                self.$input.trigger('focus');
            });
        }).fail(function (xhr) {
            self.loading = false;
            self.$input.prop('disabled', false);
            self.$send.prop('disabled', false);
            self.announce(xhr.madexMessage || xhrMessage(xhr, 'Die Chat-Sitzung konnte nicht gestartet werden.'), true);
        });
    };

    var PACKAGE_GOALS = ['website', 'wartung', 'seo', 'google-ads', 'social-media', 'foto-video', 'grafik'];

    ChatWidget.prototype.showPackageQualification = function () {
        var self = this;
        var shell = this.flowShell('Passendes Paket finden', 'Drei kurze Fragen, dann zeigen wir Ihnen, welches Paket am besten passt und warum.');
        var form = element('form', 'madex-flow-form madex-package-qualifier');
        var goalSet = element('fieldset', 'madex-fieldset');
        var goalList = element('div', 'madex-goal-grid');
        var previous = this.goals || (this.service ? [this.service] : []);
        var websiteField = this.radioField('Haben Sie bereits eine Website?', 'package-website-' + this.root.id, [
            ['yes', 'Ja'], ['no', 'Nein, noch nicht']
        ], this.hasWebsite || '');
        var sizeField = this.selectField('Wie gross ist Ihr Unternehmen?', 'package-size-' + this.root.id, [
            ['', 'Bitte auswählen'], ['1', 'Nur ich (Einzelunternehmen)'], ['2-10', '2–10 Mitarbeitende'], ['11-50', '11–50 Mitarbeitende'], ['51+', 'Mehr als 50 Mitarbeitende']
        ], this.companySize || '', true);
        var submit = element('button', 'madex-button madex-button-primary', 'Empfehlung anzeigen');

        goalSet.appendChild(element('legend', 'madex-field-label', 'Was möchten Sie erreichen? Mehrere möglich.'));
        PACKAGE_GOALS.forEach(function (key) {
            if (!SERVICE_LABELS[key]) {
                return;
            }
            var item = element('label', 'madex-goal');
            var input = element('input');
            input.type = 'checkbox';
            input.name = 'goals';
            input.value = key;
            input.checked = previous.indexOf(key) !== -1;
            item.appendChild(input);
            item.appendChild(element('span', '', SERVICE_LABELS[key]));
            goalList.appendChild(item);
        });
        goalSet.appendChild(goalList);
        submit.type = 'submit';

        form.appendChild(goalSet);
        form.appendChild(websiteField.wrap);
        form.appendChild(sizeField.wrap);
        form.appendChild(submit);
        shell.appendChild(form);
        this.$flowBody.empty().append(shell);
        this.showView('flow', '.madex-flow-title');

        form.addEventListener('submit', function (event) {
            event.preventDefault();
            var goals = Array.prototype.map.call(form.querySelectorAll('input[name="goals"]:checked'), function (input) {
                return input.value;
            });
            var website = form.querySelector('input[type="radio"]:checked');
            if (!goals.length) {
                self.announce('Bitte wählen Sie mindestens ein Ziel aus.', true);
                goalList.querySelector('input').focus();
                return;
            }
            if (!website) {
                self.announce('Bitte geben Sie an, ob Sie bereits eine Website haben.', true);
                websiteField.wrap.querySelector('input').focus();
                return;
            }
            if (!form.checkValidity()) {
                form.reportValidity();
                return;
            }
            self.goals = goals;
            self.hasWebsite = website.value;
            self.companySize = sizeField.input.value;
            self.service = goals[0];
            self.fetchPackages(submit);
        });
    };

    ChatWidget.prototype.radioField = function (label, name, choices, selected) {
        var wrap = element('fieldset', 'madex-fieldset');
        var legend = element('legend', 'madex-field-label', label);
        var options = element('div', 'madex-segmented');
        wrap.appendChild(legend);
        choices.forEach(function (choice) {
            var item = element('label', 'madex-radio-card');
            var input = element('input');
            input.type = 'radio';
            input.name = name;
            input.value = choice[0];
            input.checked = selected === choice[0];
            item.appendChild(input);
            item.appendChild(element('span', '', choice[1]));
            options.appendChild(item);
        });
        wrap.appendChild(options);
        return { wrap: wrap };
    };

    ChatWidget.prototype.selectField = function (label, id, options, selected, required) {
        var wrap = element('label', 'madex-field');
        var labelNode = element('span', 'madex-field-label', label);
        var select = element('select', 'madex-select');
        select.id = id;
        select.required = Boolean(required);
        options.forEach(function (option) {
            var node = element('option', '', option[1]);
            node.value = option[0];
            node.selected = selected === option[0];
            select.appendChild(node);
        });
        wrap.appendChild(labelNode);
        wrap.appendChild(select);
        return { wrap: wrap, input: select };
    };

    ChatWidget.prototype.fetchPackages = function (submit) {
        var self = this;
        var label = submit.textContent;
        submit.disabled = true;
        submit.textContent = 'Empfehlung wird erstellt …';

        function restore() {
            submit.disabled = false;
            submit.textContent = label;
        }

        ensureSession().done(function () {
            var payload = sessionPayload();
            payload.action = 'madex_get_packages';
            payload.nonce = config.nonce;
            payload.existing_client = self.clientStatus;
            payload.goals = self.goals;
            payload.has_website = self.hasWebsite;
            payload.company_size = self.companySize;

            $.ajax({
                url: config.ajaxUrl,
                type: 'POST',
                dataType: 'json',
                data: payload
            }).done(function (response) {
                var data = response && response.data ? response.data : {};
                var packages = Array.isArray(data.packages) ? data.packages : (Array.isArray(data) ? data : []);
                if (!response || !response.success) {
                    self.announce(responseMessage(response, 'Pakete konnten nicht geladen werden.'), true);
                    return;
                }
                self.renderPackages(packages);
            }).fail(function (xhr) {
                self.announce(xhrMessage(xhr, 'Pakete konnten nicht geladen werden.'), true);
            }).always(restore);
        }).fail(function (xhr) {
            restore();
            self.announce(xhr.madexMessage || xhrMessage(xhr, 'Verbindung fehlgeschlagen.'), true);
        });
    };

    /*
     * Features may be written as "Bereich: Leistung". They are grouped by
     * that prefix so a card reads as short sections instead of repeating it.
     */
    function groupFeatures(features) {
        var groups = [];
        var index = {};
        features.forEach(function (feature) {
            var match = /^([^:]{2,28}):\s*(.+)$/.exec(feature);
            var head = match ? match[1].trim() : '';
            var text = match ? match[2].trim() : feature;
            if (!Object.prototype.hasOwnProperty.call(index, head)) {
                index[head] = groups.length;
                groups.push({ head: head, items: [] });
            }
            groups[index[head]].items.push(text);
        });
        return groups;
    }

    function checkIcon() {
        var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('aria-hidden', 'true');
        path.setAttribute('d', 'm5 12.5 4.5 4.5L19 7.5');
        svg.appendChild(path);
        return svg;
    }

    ChatWidget.prototype.packageCard = function (pkg, recommended) {
        var self = this;
        var name = String(pkg.name || pkg.title || 'Madex Paket');
        var card = element('article', 'madex-package-card' + (recommended ? ' is-recommended' : ''));
        var features = normaliseFeatures(pkg);
        var groups = groupFeatures(features);
        var limit = recommended ? 6 : 0;
        var shown = 0;
        var body = element('div', 'madex-package-body');
        var head = element('div', 'madex-package-head');

        if (recommended) {
            head.appendChild(element('span', 'madex-package-badge', 'Unsere Empfehlung'));
        }
        head.appendChild(element('h3', 'madex-package-title', name));
        card.appendChild(head);

        var matched = Array.isArray(pkg.matched) ? pkg.matched : [];
        var missing = Array.isArray(pkg.missing) ? pkg.missing : [];
        if (matched.length) {
            var why = element('p', 'madex-package-why');
            why.appendChild(checkIcon());
            why.appendChild(element('span', '', 'Deckt ab: ' + matched.join(', ')));
            card.appendChild(why);
        }
        if (recommended && missing.length) {
            card.appendChild(element('p', 'madex-package-missing', 'Nicht enthalten: ' + missing.join(', ') + ' – fragen Sie uns nach einer Ergänzung.'));
        }

        if (pkg.short_description) {
            body.appendChild(element('p', 'madex-package-description', String(pkg.short_description)));
        }

        var list = element('div', 'madex-package-features');
        groups.forEach(function (group) {
            var ul = element('ul');
            group.items.forEach(function (text) {
                var li = element('li');
                li.appendChild(checkIcon());
                li.appendChild(element('span', '', text));
                if (limit && shown >= limit) {
                    li.hidden = true;
                    li.className = 'is-extra';
                }
                shown++;
                ul.appendChild(li);
            });
            if (group.head) {
                list.appendChild(element('p', 'madex-package-group', group.head));
            }
            list.appendChild(ul);
        });
        if (features.length) {
            body.appendChild(list);
        }
        if (pkg.audience) {
            body.appendChild(element('p', 'madex-package-audience', 'Ideal für: ' + String(pkg.audience)));
        }

        var cta = element('button', 'madex-button ' + (recommended ? 'madex-button-primary' : 'madex-button-secondary'), recommended ? 'Beratung zu diesem Paket anfragen' : 'Dieses Paket anfragen');
        cta.type = 'button';
        cta.addEventListener('click', function () {
            self.packageInterest = name;
            self.startAppointment({ package_interest: name, service: self.service });
        });

        if (recommended) {
            card.appendChild(body);
            if (limit && features.length > limit) {
                var more = element('button', 'madex-text-action madex-package-more', 'Alle ' + features.length + ' Leistungen anzeigen');
                more.type = 'button';
                more.setAttribute('aria-expanded', 'false');
                more.addEventListener('click', function () {
                    var open = more.getAttribute('aria-expanded') !== 'true';
                    Array.prototype.forEach.call(list.querySelectorAll('.is-extra'), function (li) { li.hidden = !open; });
                    more.setAttribute('aria-expanded', open ? 'true' : 'false');
                    more.textContent = open ? 'Weniger anzeigen' : 'Alle ' + features.length + ' Leistungen anzeigen';
                });
                card.appendChild(more);
            }
        } else {
            var details = element('details', 'madex-package-details');
            details.appendChild(element('summary', '', 'Details ansehen'));
            details.appendChild(body);
            card.appendChild(details);
        }
        card.appendChild(cta);
        return card;
    };

    ChatWidget.prototype.renderPackages = function (packages) {
        var self = this;
        var summary = (this.goals || []).map(function (key) { return SERVICE_LABELS[key] || key; }).join(', ');
        var shell = this.flowShell(
            packages.length ? 'Unsere Empfehlung für Sie' : 'Persönliche Beratung',
            packages.length ? 'Basierend auf Ihren Zielen: ' + summary + '.' : 'Für diese Auswahl stellen wir Ihnen gerne ein passendes Angebot zusammen.'
        );
        var list = element('div', 'madex-package-list');

        if (!packages.length) {
            var fallback = element('div', 'madex-empty-state');
            fallback.appendChild(element('h3', '', 'Wir beraten Sie persönlich'));
            fallback.appendChild(element('p', '', 'Im kostenlosen Erstgespräch klären wir, was Ihr Unternehmen wirklich braucht.'));
            var fallbackButton = element('button', 'madex-button madex-button-primary', 'Termin anfragen');
            fallbackButton.type = 'button';
            fallbackButton.addEventListener('click', function () { self.startAppointment(); });
            fallback.appendChild(fallbackButton);
            list.appendChild(fallback);
        }

        packages.forEach(function (pkg, index) {
            if (index === 1) {
                list.appendChild(element('p', 'madex-package-divider', packages.length > 2 ? 'Weitere Möglichkeiten' : 'Alternative'));
            }
            list.appendChild(self.packageCard(pkg, index === 0));
        });

        if (packages.length) {
            var help = element('p', 'madex-package-help');
            var change = element('button', 'madex-text-action', 'Angaben ändern');
            change.type = 'button';
            change.addEventListener('click', function () { self.showPackageQualification(); });
            help.appendChild(document.createTextNode('Unsicher? Das Erstgespräch ist kostenlos und unverbindlich. '));
            help.appendChild(change);
            list.appendChild(help);
        }

        shell.appendChild(list);
        this.$flowBody.empty().append(shell);
        this.showView('flow', '.madex-flow-title');
    };

    ChatWidget.prototype.defaultAppointment = function () {
        var userName = config.userName && config.userName !== 'Gast' ? String(config.userName) : '';
        return {
            customer_name: userName,
            company: '',
            email: config.userEmail ? String(config.userEmail) : '',
            phone: '',
            existing_client: this.clientStatus || '',
            service: this.service || '',
            package_interest: this.packageInterest || '',
            message: '',
            preferred_date: '',
            preferred_time: '',
            privacy_consent: false,
            idempotency_key: randomKey()
        };
    };

    ChatWidget.prototype.startAppointment = function (prefill) {
        var self = this;
        if (!this.appointment) {
            this.appointment = this.defaultAppointment();
        }
        if (prefill) {
            Object.keys(prefill).forEach(function (key) {
                if (prefill[key] && !self.appointment[key]) {
                    self.appointment[key] = prefill[key];
                }
            });
            if (prefill.service) {
                this.appointment.service = prefill.service;
            }
        }
        this.renderAppointmentStep(1);
    };

    ChatWidget.prototype.appointmentShell = function (step) {
        var shell = this.flowShell('Termin anfragen', 'Dies ist eine Anfrage. Madex bestätigt den Termin persönlich.');
        var progress = element('ol', 'madex-stepper');
        var labels = ['Kontakt', 'Anliegen', 'Wunschtermin', 'Prüfen'];
        labels.forEach(function (label, index) {
            var item = element('li', index + 1 < step ? 'is-complete' : (index + 1 === step ? 'is-current' : ''), label);
            item.setAttribute('aria-current', index + 1 === step ? 'step' : 'false');
            progress.appendChild(item);
        });
        shell.insertBefore(progress, shell.querySelector('.madex-flow-description'));
        return shell;
    };

    ChatWidget.prototype.inputField = function (label, name, type, value, required, autocomplete) {
        var wrap = element('label', 'madex-field');
        var labelNode = element('span', 'madex-field-label', label + (required ? ' *' : ''));
        var input = element('input', 'madex-input');
        input.type = type;
        input.name = name;
        input.value = value || '';
        input.required = Boolean(required);
        if (autocomplete) {
            input.autocomplete = autocomplete;
        }
        wrap.appendChild(labelNode);
        wrap.appendChild(input);
        return { wrap: wrap, input: input };
    };

    ChatWidget.prototype.textareaField = function (label, name, value, required) {
        var wrap = element('label', 'madex-field');
        var labelNode = element('span', 'madex-field-label', label + (required ? ' *' : ''));
        var input = element('textarea', 'madex-textarea');
        input.name = name;
        input.rows = 4;
        input.value = value || '';
        input.required = Boolean(required);
        wrap.appendChild(labelNode);
        wrap.appendChild(input);
        return { wrap: wrap, input: input };
    };

    ChatWidget.prototype.renderAppointmentStep = function (step) {
        var self = this;
        var shell = this.appointmentShell(step);
        var form = element('form', 'madex-flow-form madex-appointment-form');
        var title;
        var fields = {};

        if (step === 1) {
            title = 'Wie dürfen wir Sie erreichen?';
            fields.customer_name = this.inputField('Vor- und Nachname', 'customer_name', 'text', this.appointment.customer_name, true, 'name');
            fields.company = this.inputField('Unternehmen', 'company', 'text', this.appointment.company, false, 'organization');
            fields.email = this.inputField('E-Mail', 'email', 'email', this.appointment.email, true, 'email');
            fields.phone = this.inputField('Telefon', 'phone', 'tel', this.appointment.phone, false, 'tel');
            Object.keys(fields).forEach(function (key) { form.appendChild(fields[key].wrap); });
        } else if (step === 2) {
            title = 'Worum geht es?';
            fields.existing_client = this.radioField('Sind Sie bereits Madex-Kunde? *', 'appointment-client-' + this.root.id, [['yes', 'Ja'], ['no', 'Nein']], this.appointment.existing_client);
            fields.service = this.selectField('Thema oder Leistung', 'appointment-service-' + this.root.id, serviceChoices(true), this.appointment.service, true);
            fields.package_interest = this.inputField('Paket (optional)', 'package_interest', 'text', this.appointment.package_interest, false, 'off');
            fields.message = this.textareaField('Beschreiben Sie kurz Ihr Anliegen', 'message', this.appointment.message, true);
            form.appendChild(fields.existing_client.wrap);
            form.appendChild(fields.service.wrap);
            form.appendChild(fields.package_interest.wrap);
            form.appendChild(fields.message.wrap);
        } else if (step === 3) {
            title = 'Wann passt es Ihnen?';
            fields.preferred_date = this.inputField('Wunschdatum', 'preferred_date', 'date', this.appointment.preferred_date, true, 'off');
            fields.preferred_date.input.min = localDateValue(new Date());
            fields.preferred_time = this.selectField('Zeitfenster', 'appointment-time-' + this.root.id, [
                ['', 'Bitte auswählen'], ['morning', 'Vormittag (08:00–12:00)'], ['midday', 'Mittag (12:00–14:00)'], ['afternoon', 'Nachmittag (14:00–18:00)'], ['flexible', 'Flexibel']
            ], this.appointment.preferred_time, true);
            form.appendChild(fields.preferred_date.wrap);
            form.appendChild(fields.preferred_time.wrap);
            form.appendChild(element('p', 'madex-form-note', 'Ihr Wunschtermin ist noch nicht verbindlich. Wir melden uns zur Bestätigung.'));
        } else {
            this.renderAppointmentReview(shell, form);
            return;
        }

        var stepTitle = element('h3', 'madex-step-title', title);
        stepTitle.tabIndex = -1;
        form.insertBefore(stepTitle, form.firstChild);
        this.appendAppointmentNavigation(form, step, function () {
            if (!self.saveAppointmentStep(step, fields, form)) {
                return;
            }
            self.renderAppointmentStep(step + 1);
        });
        shell.appendChild(form);
        this.$flowBody.empty().append(shell);
        this.showView('flow', '.madex-step-title');
    };

    ChatWidget.prototype.appendAppointmentNavigation = function (form, step, next) {
        var self = this;
        var nav = element('div', 'madex-form-actions');
        if (step > 1) {
            var back = element('button', 'madex-button madex-button-secondary', 'Zurück');
            back.type = 'button';
            back.addEventListener('click', function () {
                self.renderAppointmentStep(step - 1);
            });
            nav.appendChild(back);
        }
        var forward = element('button', 'madex-button madex-button-primary', step === 4 ? 'Anfrage senden' : 'Weiter');
        forward.type = 'submit';
        nav.appendChild(forward);
        form.appendChild(nav);
        if (next) {
            form.addEventListener('submit', function (event) {
                event.preventDefault();
                next();
            });
        }
    };

    ChatWidget.prototype.saveAppointmentStep = function (step, fields, form) {
        if (!form.checkValidity()) {
            form.reportValidity();
            return false;
        }

        if (step === 1) {
            this.appointment.customer_name = fields.customer_name.input.value.trim();
            this.appointment.company = fields.company.input.value.trim();
            this.appointment.email = fields.email.input.value.trim();
            this.appointment.phone = fields.phone.input.value.trim();
        } else if (step === 2) {
            var selected = form.querySelector('input[type="radio"]:checked');
            if (!selected) {
                this.announce('Bitte geben Sie an, ob Sie bereits Kunde sind.', true);
                form.querySelector('input[type="radio"]').focus();
                return false;
            }
            this.appointment.existing_client = selected.value;
            this.appointment.service = fields.service.input.value;
            this.appointment.package_interest = fields.package_interest.input.value.trim();
            this.appointment.message = fields.message.input.value.trim();
        } else if (step === 3) {
            this.appointment.preferred_date = fields.preferred_date.input.value;
            this.appointment.preferred_time = fields.preferred_time.input.value;
        }

        return true;
    };

    ChatWidget.prototype.renderAppointmentReview = function (shell, form) {
        var self = this;
        var title = element('h3', 'madex-step-title', 'Bitte prüfen Sie Ihre Angaben');
        var list = element('dl', 'madex-review-list');
        var timeLabels = { morning: 'Vormittag', midday: 'Mittag', afternoon: 'Nachmittag', flexible: 'Flexibel' };
        var rows = [
            ['Name', this.appointment.customer_name],
            ['Unternehmen', this.appointment.company || '–'],
            ['E-Mail', this.appointment.email],
            ['Telefon', this.appointment.phone || '–'],
            ['Kunde', this.appointment.existing_client === 'yes' ? 'Ja' : 'Nein'],
            ['Leistung', serviceLabel(this.appointment.service)],
            ['Paket', this.appointment.package_interest || '–'],
            ['Wunschtermin', longDate(this.appointment.preferred_date) + ' · ' + (timeLabels[this.appointment.preferred_time] || this.appointment.preferred_time)]
        ];
        title.tabIndex = -1;
        form.appendChild(title);

        rows.forEach(function (row) {
            list.appendChild(element('dt', '', row[0]));
            list.appendChild(element('dd', '', String(row[1] || '–')));
        });
        form.appendChild(list);

        var edit = element('button', 'madex-text-action madex-edit-appointment', 'Angaben bearbeiten');
        edit.type = 'button';
        edit.addEventListener('click', function () { self.renderAppointmentStep(1); });
        form.appendChild(edit);

        var consent = element('label', 'madex-consent');
        var checkbox = element('input');
        checkbox.type = 'checkbox';
        checkbox.required = true;
        checkbox.checked = this.appointment.privacy_consent;
        consent.appendChild(checkbox);
        var consentText = element('span', '', 'Ich stimme der Verarbeitung meiner Daten zur Bearbeitung dieser Anfrage zu');
        if (config.privacyUrl) {
            var privacyLink = element('a', 'madex-message-link', 'Datenschutzerklärung');
            privacyLink.href = String(config.privacyUrl);
            privacyLink.target = '_blank';
            privacyLink.rel = 'noopener noreferrer';
            consentText.appendChild(document.createTextNode(' (gemäss '));
            consentText.appendChild(privacyLink);
            consentText.appendChild(document.createTextNode(')'));
        }
        consentText.appendChild(document.createTextNode('. *'));
        consent.appendChild(consentText);
        form.appendChild(consent);

        var status = element('div', 'madex-submit-status');
        status.setAttribute('role', 'alert');
        status.hidden = true;
        form.appendChild(status);
        this.appendAppointmentNavigation(form, 4);
        form.addEventListener('submit', function (event) {
            event.preventDefault();
            if (!form.checkValidity()) {
                form.reportValidity();
                return;
            }
            self.appointment.privacy_consent = checkbox.checked;
            self.submitAppointment(form, status);
        });

        shell.appendChild(form);
        this.$flowBody.empty().append(shell);
        this.showView('flow', '.madex-step-title');
    };

    ChatWidget.prototype.submitAppointment = function (form, status) {
        var self = this;
        var submit = form.querySelector('button[type="submit"]');
        submit.disabled = true;
        submit.textContent = 'Wird gesendet …';
        status.hidden = true;

        ensureSession().done(function () {
            var payload = $.extend({}, self.appointment, sessionPayload(), {
                action: 'madex_submit_appointment',
                nonce: config.nonce,
                privacy_consent: '1'
            });

            $.ajax({
                url: config.ajaxUrl,
                type: 'POST',
                dataType: 'json',
                data: payload
            }).done(function (response) {
                if (!response || !response.success) {
                    status.textContent = responseMessage(response, 'Die Anfrage konnte nicht gesendet werden. Ihre Eingaben bleiben erhalten.');
                    status.hidden = false;
                    return;
                }
                self.renderAppointmentSuccess(response.data || {});
            }).fail(function (xhr) {
                if (invalidSessionResponse(xhr)) {
                    clearSession();
                }
                status.textContent = xhrMessage(xhr, 'Die Anfrage konnte nicht gesendet werden. Bitte versuchen Sie es erneut.');
                status.hidden = false;
            }).always(function () {
                submit.disabled = false;
                submit.textContent = 'Anfrage senden';
            });
        }).fail(function (xhr) {
            status.textContent = xhr.madexMessage || xhrMessage(xhr, 'Die sichere Verbindung konnte nicht hergestellt werden.');
            status.hidden = false;
            submit.disabled = false;
            submit.textContent = 'Anfrage senden';
        });
    };

    ChatWidget.prototype.renderAppointmentSuccess = function (data) {
        var self = this;
        var shell = element('div', 'madex-success-state');
        var icon = element('div', 'madex-success-icon', '✓');
        var title = element('h2', '', 'Anfrage gesendet');
        var body = element('p', '', data.message ? String(data.message) : 'Vielen Dank. Das Madex-Team bestätigt Ihren Wunschtermin persönlich.');
        var reference = element('div', 'madex-reference-card');
        var actions = element('div', 'madex-success-actions');
        var newConversation = element('button', 'madex-button madex-button-secondary', 'Neues Gespräch starten');
        var closeChat = element('button', 'madex-text-action', 'Chat schliessen');
        icon.setAttribute('aria-hidden', 'true');
        title.tabIndex = -1;
        title.setAttribute('role', 'status');
        reference.appendChild(element('span', '', 'Referenznummer'));
        reference.appendChild(element('strong', '', String(data.reference || 'Wird per E-Mail mitgeteilt')));
        if (data.preferred_date) {
            reference.appendChild(element('small', '', longDate(String(data.preferred_date)) + (data.preferred_time ? ' · ' + String(data.preferred_time) : '')));
        }
        newConversation.type = 'button';
        newConversation.addEventListener('click', function () { self.resetConversation(); });
        closeChat.type = 'button';
        closeChat.addEventListener('click', function () {
            self.showView('welcome');
            self.close();
        });
        shell.appendChild(icon);
        shell.appendChild(title);
        shell.appendChild(body);
        shell.appendChild(reference);
        actions.appendChild(newConversation);
        if (!this.embedded) {
            actions.appendChild(closeChat);
        }
        shell.appendChild(actions);
        this.$flowBody.empty().append(shell);
        this.showView('flow', '.madex-success-state h2');
        this.appointment = null;
    };

    /* Starts fresh; the previous conversation stays in the history list. */
    ChatWidget.prototype.resetConversation = function () {
        var self = this;
        var previous = session.id ? readHistory().filter(function (item) { return item.id === session.id; })[0] : null;
        var detach = previous && previous.title ? $.Deferred().resolve().promise() : endSession();
        if (previous && !previous.title) {
            forgetSession(previous.id);
        }
        clearSession();
        detach.always(function () {
            self.$messages.empty();
            self.messagesLoaded = false;
            self.clientStatus = '';
            self.packageInterest = '';
            self.service = '';
            self.goals = null;
            self.hasWebsite = '';
            self.companySize = '';
            self.appointment = null;
            self.openConversation();
        });
    };

    ChatWidget.prototype.continueConversation = function (id) {
        var entry = readHistory().filter(function (item) { return item.id === id; })[0];
        if (!entry) {
            this.renderHistory();
            return;
        }
        if (entry.id !== session.id) {
            storeSession(entry.id, entry.token);
            this.$messages.empty();
            this.messagesLoaded = false;
        }
        this.openConversation();
    };

    function historyDate(timestamp) {
        var date = new Date(Number(timestamp) || 0);
        var today = new Date();
        if (!timestamp || isNaN(date.getTime())) {
            return '';
        }
        if (date.toDateString() === today.toDateString()) {
            return 'Heute, ' + date.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' });
        }
        return date.toLocaleDateString('de-CH', { day: 'numeric', month: 'long' });
    }

    ChatWidget.prototype.renderHistory = function () {
        var $box = this.$root.find('[data-madex-history]');
        var list = this.$root.find('[data-madex-history-list]').get(0);
        var entries = readHistory().filter(function (item) { return item.title; });
        if (!list) {
            return;
        }
        list.textContent = '';
        entries.forEach(function (item) {
            var li = element('li');
            var button = element('button', 'madex-history-item');
            var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            var text = element('span', 'madex-history-text');
            button.type = 'button';
            button.setAttribute('data-madex-history-id', item.id);
            svg.setAttribute('viewBox', '0 0 24 24');
            svg.setAttribute('aria-hidden', 'true');
            path.setAttribute('d', 'M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v7a2.5 2.5 0 0 1-2.5 2.5H10l-5 4v-4.5A2.5 2.5 0 0 1 4 12.5z');
            svg.appendChild(path);
            text.appendChild(element('span', 'madex-history-name', item.title));
            text.appendChild(element('span', 'madex-history-date', historyDate(item.updated)));
            button.appendChild(svg);
            button.appendChild(text);
            if (item.id === session.id) {
                button.appendChild(element('span', 'madex-history-current', 'Fortsetzen'));
            }
            li.appendChild(button);
            list.appendChild(li);
        });
        $box.prop('hidden', !entries.length);
    };

    /*
     * Theme isolation
     *
     * The server renders the widget inside an inert <template>. Here it is moved
     * into a Shadow DOM on the <madex-chatbot> host and chatbot.css is loaded
     * inside that shadow root, so no theme, page builder or optimisation plugin
     * stylesheet can restyle the widget, and the widget cannot restyle the site.
     */
    var FONT_STYLE_ID = 'madex-chatbot-fonts';

    function injectFonts() {
        // @font-face rules are not applied from inside a shadow root in every
        // browser, so the uniquely named family is registered on the document.
        if (!config.fontsUrl || document.getElementById(FONT_STYLE_ID)) {
            return;
        }
        var base = String(config.fontsUrl);
        var style = document.createElement('style');
        style.id = FONT_STYLE_ID;
        style.textContent = [
            ['manrope-latin-variable.woff2', 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD'],
            ['manrope-latin-ext-variable.woff2', 'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF']
        ].map(function (font) {
            return '@font-face{font-family:"Madex Manrope";src:url("' + base + font[0] + '") format("woff2");' +
                'font-style:normal;font-weight:400 800;font-display:swap;unicode-range:' + font[1] + ';}';
        }).join('');
        (document.head || document.documentElement).appendChild(style);
    }

    function repairLazyImages(scope) {
        // Lazy-load plugins rewrite <img> tags in the page HTML, but their
        // scripts cannot see into the shadow root. Restore the real source.
        Array.prototype.forEach.call(scope.querySelectorAll('img'), function (img) {
            var real = img.getAttribute('data-lazy-src') || img.getAttribute('data-src');
            if (real && img.getAttribute('src') !== real) {
                img.setAttribute('src', real);
            }
            img.removeAttribute('data-lazy-src');
            img.removeAttribute('data-src');
            img.removeAttribute('srcset');
            img.classList.remove('lazyload', 'lazy');
        });
    }

    function mountHost(host) {
        var template = host.querySelector('template[data-madex-chat-template]');
        var root;
        var scope;
        var boot;
        var link;
        var revealed = false;

        if (!template) {
            return null;
        }

        if (host.getAttribute('data-embedded') !== 'true' && host.parentNode !== document.body) {
            // Keep the floating launcher out of transformed theme wrappers, which
            // would break position: fixed.
            document.body.appendChild(host);
        }

        scope = typeof host.attachShadow === 'function' ? host.attachShadow({ mode: 'open' }) : host;
        boot = document.createElement('style');
        boot.textContent = '[data-madex-chat-root]{visibility:hidden!important}';
        link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = String(config.stylesheetUrl || '');

        function reveal() {
            if (!revealed) {
                revealed = true;
                if (boot.parentNode) {
                    boot.parentNode.removeChild(boot);
                }
            }
        }

        link.addEventListener('load', reveal);
        link.addEventListener('error', reveal);
        window.setTimeout(reveal, 4000);

        scope.appendChild(boot);
        if (link.href) {
            scope.appendChild(link);
        } else {
            reveal();
        }
        scope.appendChild(document.importNode(template.content, true));
        template.parentNode.removeChild(template);
        repairLazyImages(scope);

        root = scope.querySelector('[data-madex-chat-root]');
        return root;
    }

    loadSession();

    $(function () {
        injectFonts();
        $('[data-madex-chat-host]').each(function () {
            var root;
            if ($.data(this, 'madexChatWidget')) {
                return;
            }
            root = mountHost(this);
            if (root) {
                $.data(this, 'madexChatWidget', new ChatWidget(root));
            }
        });
        scrollToLinkedSection();
    });

    /* Arriving from a chat button on another page: scroll to that area. */
    function scrollToLinkedSection() {
        var match = /^#madex-([a-z0-9-]+)$/.exec(window.location.hash || '');
        var section = match ? sectionByKey(match[1]) : null;
        var tries = 0;
        if (!section) {
            return;
        }
        (function attempt() {
            // Page builders often render sections late; retry briefly.
            if (!scrollToSection(section) && ++tries < 10) {
                window.setTimeout(attempt, 400);
            }
        })();
    }
})(jQuery);
