// Simple Dark Mode utility
export const initDarkMode = () => {
    const saved = localStorage.getItem('darkMode');
    if (saved === 'true') {
        document.documentElement.classList.add('dark');
    }
};

export const toggleDarkMode = () => {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('darkMode', isDark ? 'true' : 'false');
    return isDark;
};

export const isDarkMode = () => {
    return document.documentElement.classList.contains('dark');
};
