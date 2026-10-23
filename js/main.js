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

    // Theme toggle. The saved choice is applied in <head> before first paint;
    // with no saved choice the page follows the OS setting.
    const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const currentTheme = () => root.dataset.theme || (darkQuery.matches ? 'dark' : 'light');
    const syncThemeLabel = () => {
        const next = currentTheme() === 'dark' ? 'light' : 'dark';
        themeToggle.setAttribute('aria-label', `Switch to ${next} theme`);
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
    darkQuery.addEventListener('change', syncThemeLabel);
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
        </li>`).join('');

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
        panels.nearby.innerHTML = `<ul class="info-list">
            ${row('local_gas_station', 'Fuel', d.nearby.fuel)}
            ${row('atm', 'Cash', d.nearby.atm)}
            ${row('local_hospital', 'Medical care', d.nearby.hospital)}
            ${row('signal_cellular_alt', 'Mobile network', d.nearby.network)}
        </ul>`;

        selectTab(tabs[0]);
        dialog.showModal();
        dialog.scrollTop = 0;
    };

    grid.addEventListener('click', (e) => {
        const card = e.target.closest('[data-dest]');
        if (!card) return;
        const d = destinations.find((x) => x.id === card.dataset.dest);
        if (d) openDestination(d, card);
    });

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
