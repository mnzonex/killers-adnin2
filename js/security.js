/**
 * Security script for Admin Dashboard only.
 */

(function () {
    document.addEventListener('contextmenu', e => e.preventDefault());
    document.onkeydown = function (e) {
        if (e.keyCode == 123 || (e.ctrlKey && e.shiftKey && (e.keyCode == 73 || e.keyCode == 74 || e.keyCode == 67)) || (e.ctrlKey && (e.keyCode == 85 || e.keyCode == 83))) {
            return false;
        }
    };
})();
