exports = (timeString) => {
    const [hours, minutes] = timeString.split(':').map(Number);

    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date;
};