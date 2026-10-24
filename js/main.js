const root = document.documentElement;

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));
const icon = (name, extra = '') => `<span class="icon${extra}" aria-hidden="true">${name}</span>`;

document.addEventListener('DOMContentLoaded', () => {
    const header = document.querySelector('[data-header]');
    const navToggle = document.querySelector('[data-nav-toggle]');
    const themeToggle = document.querySelector('[data-theme-toggle]');

    // Mobile menu
    const setMenuOpen = (open) => {
        header.classList.toggle('is-open', open);
        navToggle.setAttribute('aria-expanded', String(open));
        navToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    };

    navToggle.addEventListener('click', () => {
        setMenuOpen(!header.classList.contains('is-open'));
    });

    header.querySelectorAll('.site-nav a').forEach((link) => {
        link.addEventListener('click', () => setMenuOpen(false));
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && header.classList.contains('is-open')) {
            setMenuOpen(false);
            navToggle.focus();
        }
    });

    // Close the panel if the viewport grows past the mobile breakpoint.
    window.matchMedia('(min-width: 881px)').addEventListener('change', (e) => {
        if (e.matches) setMenuOpen(false);
    });

    // Header gains a border and shadow once the page scrolls.
    const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    // Theme toggle. The site opens in light mode; a visitor's saved choice is
    // applied in <head> before first paint.
    const themeColor = document.querySelector('meta[name="theme-color"]');
    const currentTheme = () => (root.dataset.theme === 'dark' ? 'dark' : 'light');
    const syncThemeLabel = () => {
        const dark = currentTheme() === 'dark';
        themeToggle.setAttribute('aria-label', `Switch to ${dark ? 'light' : 'dark'} theme`);
        // Keep the mobile browser's address bar in step with the page.
        themeColor?.setAttribute('content', dark ? '#0F0E1A' : '#F8F9FA');
    };

    themeToggle.addEventListener('click', () => {
        const next = currentTheme() === 'dark' ? 'light' : 'dark';
        root.dataset.theme = next;
        try {
            localStorage.setItem('zipsway-theme', next);
        } catch (e) {
            // Storage unavailable (private mode, blocked cookies): the toggle
            // still works for this visit.
        }
        syncThemeLabel();
    });
    syncThemeLabel();

    // Destination cards — rendered before the reveal observer below picks
    // up every [data-reveal] element.
    const destinations = window.ZIPSWAY_DESTINATIONS || [];
    const regions = window.ZIPSWAY_REGIONS || {};
    const grid = document.querySelector('[data-dest-grid]');

    grid.innerHTML = destinations.map((d, i) => `
        <li class="dest-item" data-region="${d.region}" data-reveal style="--delay: ${(i % 3) * 80}ms">
            <button class="dest-card" type="button" data-dest="${d.id}" aria-haspopup="dialog"
                    aria-label="${escapeHtml(`${d.name}, ${d.district}: see details`)}">
                <img src="${d.image.src}" width="${d.image.width}" height="${d.image.height}" loading="lazy" alt="">
                <span class="dest-card-body">
                    <span class="dest-region">${escapeHtml(regions[d.region])}</span>
                    <strong class="dest-name">${escapeHtml(d.name)}</strong>
                    <span class="dest-tagline">${escapeHtml(d.tagline)}</span>
                    <span class="dest-meta">
                        <span>${icon('calendar_month')}${escapeHtml(d.season)}</span>
                        <span>${icon('location_on')}${escapeHtml(d.district)}</span>
                    </span>
                </span>
            </button>
            <button class="trip-add trip-toggle" type="button" aria-pressed="false" data-trip-toggle="${d.id}"
                    aria-label="${escapeHtml(`Add ${d.name} to trip`)}">
                ${icon('add', ' trip-icon-add')}${icon('check', ' trip-icon-added')}
            </button>
        </li>`).join('');

    // Odisha map. Pins use the same projection the outline was drawn with
    // (equirectangular, cos(lat)-corrected, 1000 × 839 viewBox), placed as
    // HTML buttons in % so their labels stay readable at any width.
    const MAP = { minLng: 81.396071, maxLat: 22.567512, k: 0.938553, scale: 167.965074, pad: 20, w: 1000, h: 839 };
    const project = ({ lat, lng }) => ({
        x: (((lng - MAP.minLng) * MAP.k * MAP.scale + MAP.pad) / MAP.w) * 100,
        y: (((MAP.maxLat - lat) * MAP.scale + MAP.pad) / MAP.h) * 100,
    });
    // Labels default to the right of the pin; these sit left to avoid the
    // coastline edge or a neighbouring hub label.
    const labelLeft = new Set(['mangalajodi', 'daringbadi', 'bhitarkanika', 'chandipur', 'similipal', 'hirakud']);
    const map = document.querySelector('[data-map]');
    if (map) {
        const hubs = (window.ZIPSWAY_HUBS || []).map((hub) => {
            const p = project(hub);
            return `<span class="map-hub" style="left: ${p.x}%; top: ${p.y}%" aria-hidden="true">${escapeHtml(hub.name)}</span>`;
        });
        const pins = destinations.map((d) => {
            const p = project(d.coords);
            return `<button class="map-pin region-${d.region}${labelLeft.has(d.id) ? ' label-left' : ''}" type="button"
                        style="left: ${p.x}%; top: ${p.y}%" data-dest="${d.id}" data-region="${d.region}" aria-haspopup="dialog"
                        aria-label="${escapeHtml(`${d.name}, ${d.district} district`)}">
                        <span class="map-dot"></span><span class="map-label">${escapeHtml(d.name)}</span>
                    </button>`;
        });
        map.insertAdjacentHTML('beforeend', hubs.join('') + pins.join(''));
    }

    // Region filter
    const filterButtons = document.querySelectorAll('[data-dest-filters] [data-filter]');
    const countEl = document.querySelector('[data-dest-count]');
    filterButtons.forEach((button) => {
        button.addEventListener('click', () => {
            const filter = button.dataset.filter;
            filterButtons.forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
            let shown = 0;
            grid.querySelectorAll('.dest-item').forEach((item) => {
                const match = filter === 'all' || item.dataset.region === filter;
                item.hidden = !match;
                if (match) shown += 1;
            });
            // Pins stay clickable but fade back, so the whole state stays visible.
            document.querySelectorAll('.map-pin').forEach((pin) => {
                pin.classList.toggle('is-dimmed', filter !== 'all' && pin.dataset.region !== filter);
            });
            countEl.textContent = `Showing ${shown} destination${shown === 1 ? '' : 's'}`;
        });
    });

    // Destination detail window
    const dialog = document.querySelector('[data-dest-dialog]');
    const tabs = [...dialog.querySelectorAll('[role="tab"]')];
    const panels = Object.fromEntries(
        [...dialog.querySelectorAll('[data-panel]')].map((p) => [p.dataset.panel, p])
    );
    let opener = null;

    const selectTab = (tab, focus = false) => {
        tabs.forEach((t) => {
            const selected = t === tab;
            t.setAttribute('aria-selected', String(selected));
            t.tabIndex = selected ? 0 : -1;
            document.getElementById(t.getAttribute('aria-controls')).hidden = !selected;
        });
        if (focus) tab.focus();
    };

    tabs.forEach((tab, i) => {
        tab.addEventListener('click', () => selectTab(tab));
        tab.addEventListener('keydown', (e) => {
            const moves = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 };
            if (!(e.key in moves)) return;
            e.preventDefault();
            selectTab(tabs[(moves[e.key] + tabs.length) % tabs.length], true);
        });
    });

    const row = (iconName, label, text) => `
        <li>${icon(iconName)}<span><strong>${escapeHtml(label)}</strong>${escapeHtml(text)}</span></li>`;

    const openDestination = (d, from) => {
        opener = from;
        const img = dialog.querySelector('[data-dest-img]');
        img.src = d.image.src;
        img.width = d.image.width;
        img.height = d.image.height;
        img.alt = d.image.alt;
        dialog.querySelector('[data-dest-region]').textContent = `${regions[d.region]} · ${d.district} district`;
        dialog.querySelector('[data-dest-name]').textContent = d.name;
        dialog.querySelector('[data-dest-intro]').textContent = d.intro;
        dialog.querySelector('[data-dest-facts]').innerHTML = [
            row('calendar_month', 'Best time', d.season),
            row('location_on', 'Nearest hub', d.hub),
            row('schedule', 'Stay for', d.stayFor),
        ].join('');

        panels.see.innerHTML = `<ul class="detail-list">${d.see.map(([t, text]) => `
            <li><strong>${escapeHtml(t)}</strong>${escapeHtml(text)}</li>`).join('')}</ul>`;
        panels.go.innerHTML = `<ul class="info-list">
            ${row('train', 'By rail', d.getThere.rail)}
            ${row('flight', 'By air', d.getThere.air)}
            ${row('route', 'By road', d.getThere.road)}
            ${row('lightbulb', 'Tip', d.getThere.tip)}
        </ul>
        <p class="panel-cta">${icon('directions_car')}Rent from a local shop — self-drive or with a driver.</p>`;
        panels.eat.innerHTML = `<ul class="info-list">${d.eat.map(([t, text]) => row('restaurant', t, text)).join('')}</ul>
        <p class="panel-cta">${icon('cottage')}Homestays nearby cook these for guests.</p>`;
        panels.guides.innerHTML = `<ul class="info-list">${d.guides.map(([role, offer, langs]) => `
            <li>${icon('hiking')}<span><strong>${escapeHtml(role)}</strong>${escapeHtml(offer)}
                <span class="info-sub">${icon('translate')}${escapeHtml(langs)}</span></span></li>`).join('')}</ul>
        <p class="panel-cta">${icon('verified_user')}Guides are ID-checked, and bookable with your ride or stay.</p>`;
        panels.nearby.innerHTML = `<ul class="info-list">
            ${row('local_gas_station', 'Fuel', d.nearby.fuel)}
            ${row('atm', 'Cash', d.nearby.atm)}
            ${row('local_hospital', 'Medical care', d.nearby.hospital)}
            ${row('signal_cellular_alt', 'Mobile network', d.nearby.network)}
        </ul>`;

        const tripButton = dialog.querySelector('[data-dest-trip]');
        tripButton.dataset.tripToggle = d.id;
        syncTripButtons();

        selectTab(tabs[0]);
        dialog.showModal();
        dialog.scrollTop = 0;
    };

    const openFromEvent = (e) => {
        const trigger = e.target.closest('[data-dest]');
        if (!trigger) return;
        const d = destinations.find((x) => x.id === trigger.dataset.dest);
        if (d) openDestination(d, trigger);
    };
    grid.addEventListener('click', openFromEvent);
    map?.addEventListener('click', openFromEvent);

    dialog.querySelectorAll('[data-dest-close]').forEach((el) => {
        el.addEventListener('click', () => dialog.close());
    });
    // A click on the backdrop lands on the <dialog> element itself.
    dialog.addEventListener('click', (e) => {
        if (e.target === dialog) dialog.close();
    });
    dialog.addEventListener('close', () => {
        if (opener && !opener.closest('[hidden]')) opener.focus();
    });

    // Trip planner. A trip is an ordered list of destination ids, kept in
    // this browser (localStorage) so it survives a reload.
    const TRIP_KEY = 'zipsway-trip';
    const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const byId = Object.fromEntries(destinations.map((d) => [d.id, d]));
    const planner = document.querySelector('[data-planner]');
    const tripList = document.querySelector('[data-trip-list]');
    const tripFab = document.querySelector('[data-trip-fab]');
    const tripStatus = document.createElement('p');
    tripStatus.className = 'visually-hidden';
    tripStatus.setAttribute('aria-live', 'polite');
    planner?.append(tripStatus);

    let trip = [];
    try {
        const saved = JSON.parse(localStorage.getItem(TRIP_KEY) || '[]');
        if (Array.isArray(saved)) trip = saved.filter((id) => byId[id]);
    } catch (e) {
        // No storage (private mode, blocked site data): start with an empty trip.
    }

    function setTrip(next, message) {
        trip = next;
        try {
            localStorage.setItem(TRIP_KEY, JSON.stringify(trip));
        } catch (e) {
            // The trip still works for this visit.
        }
        renderTrip();
        if (message) tripStatus.textContent = message;
    }

    function syncTripButtons() {
        document.querySelectorAll('[data-trip-toggle]').forEach((button) => {
            const id = button.dataset.tripToggle;
            if (id) button.setAttribute('aria-pressed', String(trip.includes(id)));
        });
    }

    function renderTrip() {
        if (!planner) return;
        const stops = trip.map((id) => byId[id]);
        const total = stops.reduce((sum, d) => sum + d.days, 0);
        const overlap = stops.length
            ? [...Array(12).keys()].map((i) => i + 1).filter((m) => stops.every((d) => d.months.includes(m)))
            : [];

        planner.querySelector('[data-trip-empty]').hidden = stops.length > 0;
        planner.querySelector('[data-trip-clear]').hidden = stops.length === 0;
        tripList.innerHTML = stops.map((d, i) => `
            <li class="${i === stops.length - 1 ? 'is-destination' : ''}">
                <div class="trip-stop">
                    <img src="${d.image.src}" width="${d.image.width}" height="${d.image.height}" loading="lazy" alt="">
                    <span class="trip-stop-text">
                        <strong>${escapeHtml(d.name)}</strong>
                        <span>${escapeHtml(d.district)} · ${d.days} day${d.days === 1 ? '' : 's'} · from ${escapeHtml(d.hub)}</span>
                    </span>
                    <span class="trip-stop-actions">
                        <button class="icon-btn" type="button" data-trip-move="-1" data-id="${d.id}"
                                aria-label="${escapeHtml(`Move ${d.name} earlier`)}"${i === 0 ? ' disabled' : ''}>${icon('arrow_upward')}</button>
                        <button class="icon-btn" type="button" data-trip-move="1" data-id="${d.id}"
                                aria-label="${escapeHtml(`Move ${d.name} later`)}"${i === stops.length - 1 ? ' disabled' : ''}>${icon('arrow_downward')}</button>
                        <button class="icon-btn" type="button" data-trip-remove="${d.id}"
                                aria-label="${escapeHtml(`Remove ${d.name}`)}">${icon('close')}</button>
                    </span>
                </div>
            </li>`).join('');

        planner.querySelector('[data-trip-count]').textContent = stops.length;
        planner.querySelector('[data-trip-days]').textContent = stops.length ? `${total} day${total === 1 ? '' : 's'}` : '—';
        planner.querySelectorAll('[data-trip-months] [data-m]').forEach((li) => {
            li.classList.toggle('is-on', overlap.includes(Number(li.dataset.m)));
        });
        planner.querySelector('[data-trip-months-note]').textContent = !stops.length
            ? 'Add a place to see its best months.'
            : overlap.length
                ? `Best months: ${overlap.map((m) => MONTH_NAMES[m - 1]).join(', ')}.`
                : 'No single month suits every stop — try splitting this into two trips.';
        const hubs = [...new Set(stops.map((d) => d.hub))];
        planner.querySelector('[data-trip-hubs]').textContent = hubs.length ? hubs.join(' · ') : '—';

        if (tripFab) {
            tripFab.hidden = stops.length === 0;
            tripFab.querySelector('[data-trip-fab-count]').textContent = stops.length;
        }
        syncTripButtons();
    }

    document.addEventListener('click', (e) => {
        const toggle = e.target.closest('[data-trip-toggle]');
        if (toggle?.dataset.tripToggle) {
            const id = toggle.dataset.tripToggle;
            const name = byId[id].name;
            if (trip.includes(id)) setTrip(trip.filter((x) => x !== id), `Removed ${name} from your trip`);
            else setTrip([...trip, id], `Added ${name} to your trip`);
            return;
        }

        const move = e.target.closest('[data-trip-move]');
        if (move) {
            const id = move.dataset.id;
            const dir = Number(move.dataset.tripMove);
            const from = trip.indexOf(id);
            const next = [...trip];
            next.splice(from, 1);
            next.splice(from + dir, 0, id);
            setTrip(next, `Moved ${byId[id].name} to stop ${from + dir + 1}`);
            // Keep focus on the stop that moved; fall back to its other arrow at the ends.
            const same = tripList.querySelector(`[data-trip-move="${dir}"][data-id="${id}"]`);
            (same && !same.disabled ? same : tripList.querySelector(`[data-trip-move="${-dir}"][data-id="${id}"]`))?.focus();
            return;
        }

        const remove = e.target.closest('[data-trip-remove]');
        if (remove) {
            const id = remove.dataset.tripRemove;
            const index = trip.indexOf(id);
            setTrip(trip.filter((x) => x !== id), `Removed ${byId[id].name} from your trip`);
            const buttons = tripList.querySelectorAll('[data-trip-remove]');
            (buttons[Math.min(index, buttons.length - 1)] || planner.querySelector('[data-trip-sample]'))?.focus();
            return;
        }

        if (e.target.closest('[data-trip-clear]')) {
            setTrip([], 'Trip cleared');
            planner.querySelector('[data-trip-sample]')?.focus();
            return;
        }

        const sample = e.target.closest('[data-trip-sample]');
        if (sample) {
            setTrip(sample.dataset.tripSample.split(','), `Sample trip added: ${sample.textContent}`);
            tripList.querySelector('[data-trip-remove]')?.focus();
        }
    });

    // The floating "My trip" button steps aside while the planner is on screen.
    if (planner && tripFab && 'IntersectionObserver' in window) {
        new IntersectionObserver(([entry]) => {
            tripFab.classList.toggle('is-away', entry.isIntersecting);
        }).observe(planner);
    }

    renderTrip();

    // Horizontal scrollers (food, months) with previous/next buttons.
    document.querySelectorAll('[data-scroller]').forEach((scroller) => {
        const prev = document.querySelector(`[data-scroll-prev="${scroller.id}"]`);
        const next = document.querySelector(`[data-scroll-next="${scroller.id}"]`);
        const step = () => scroller.clientWidth * 0.8;
        const sync = () => {
            if (prev) prev.disabled = scroller.scrollLeft <= 2;
            if (next) next.disabled = scroller.scrollLeft + scroller.clientWidth >= scroller.scrollWidth - 2;
        };
        prev?.addEventListener('click', () => scroller.scrollBy({ left: -step(), behavior: 'smooth' }));
        next?.addEventListener('click', () => scroller.scrollBy({ left: step(), behavior: 'smooth' }));
        scroller.addEventListener('scroll', sync, { passive: true });
        window.addEventListener('resize', sync);
        sync();
    });

    // Highlight this month in the calendar and start the strip there.
    // scrollLeft (not scrollIntoView) so the page itself doesn't jump.
    const months = document.querySelector('[data-months]');
    const thisMonth = months?.querySelector(`[data-month="${new Date().getMonth() + 1}"]`);
    if (thisMonth) {
        thisMonth.classList.add('is-now');
        thisMonth.querySelector('h3').insertAdjacentHTML('beforeend', ' <span class="now-badge">This month</span>');
        // .scroller is position: relative, so offsetLeft is measured from it.
        months.scrollLeft = thisMonth.offsetLeft - parseFloat(getComputedStyle(months).paddingLeft);
        months.dispatchEvent(new Event('scroll'));
    }

    // Scroll reveal
    const revealEls = document.querySelectorAll('[data-reveal]');
    if ('IntersectionObserver' in window) {
        const revealObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    revealObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
        revealEls.forEach((el) => revealObserver.observe(el));
    } else {
        revealEls.forEach((el) => el.classList.add('is-visible'));
    }

    // Highlight the nav link for the section currently in view.
    const navLinks = new Map();
    header.querySelectorAll('.nav-list a[href^="#"]').forEach((link) => {
        navLinks.set(link.getAttribute('href').slice(1), link);
    });

    if ('IntersectionObserver' in window) {
        const spyObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                const link = navLinks.get(entry.target.id);
                if (link) link.classList.toggle('is-active', entry.isIntersecting);
            });
        }, { rootMargin: '-45% 0px -50% 0px' });
        navLinks.forEach((_, id) => {
            const section = document.getElementById(id);
            if (section) spyObserver.observe(section);
        });
    }

    const year = document.querySelector('[data-year]');
    if (year) year.textContent = new Date().getFullYear();
});
