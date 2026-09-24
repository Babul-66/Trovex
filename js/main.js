const root = document.documentElement;

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
            localStorage.setItem('trovex-theme', next);
        } catch (e) {
            // Storage unavailable (private mode, blocked cookies): the toggle
            // still works for this visit.
        }
        syncThemeLabel();
    });
    darkQuery.addEventListener('change', syncThemeLabel);
    syncThemeLabel();

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
