// Stackr Admin — Router (#members, #member/<id>, #audit) und Start
(function () {
    'use strict';
    var A = window.Admin, $ = A.$;
    var SECTIONS = { dashboard: 'view-dashboard', flags: 'view-flags', betrieb: 'view-betrieb', members: 'view-members', member: 'view-member', dunning: 'view-dunning', audit: 'view-audit' };

    A.route = function () {
        if (!A.me) return;
        var parts = (location.hash || '#dashboard').slice(1).split('/');
        var name = SECTIONS[parts[0]] ? parts[0] : 'dashboard';
        Object.keys(SECTIONS).forEach(function (k) { $(SECTIONS[k]).hidden = k !== name; });
        document.querySelectorAll('[data-nav]').forEach(function (a) {
            var on = a.getAttribute('data-nav') === (name === 'member' ? 'members' : name);
            a.classList.toggle('active', on);
        });
        if (A.views[name]) A.views[name].show(parts.slice(1).join('/'));
    };

    window.addEventListener('hashchange', A.route);
    A.start();
})();
