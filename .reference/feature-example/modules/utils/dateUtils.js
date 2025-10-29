/**
 * Date Utilities Module
 * 
 * Provides date validation, conversion, and calculation utilities
 * for handling various date formats found in Salesforce case data.
 */

/**
 * Calculates the difference in minutes between a given date and the current time.
 * @param {Date} date The date to compare against the current time.
 * @returns {number} The total time difference in minutes.
 */
export function calculateTimeDifferenceInMinutes(date) {
    const openDate = new Date(date);
    const currentDate = new Date();
    const timeDifferenceInMilliseconds = Math.abs(currentDate - openDate);
    return timeDifferenceInMilliseconds / (1000 * 60);
}

/**
 * Compares two date strings and returns the `Date` object for the earlier of the two.
 * @param {string} date1Str The first date string in a format parseable by `new Date()`.
 * @param {string} date2Str The second date string in a format parseable by `new Date()`.
 * @returns {Date} The `Date` object representing the earlier of the two dates.
 */
export function getEarlierDate(date1Str, date2Str) {
    const date1 = new Date(date1Str);
    const date2 = new Date(date2Str);
    return date1 < date2 ? date1 : date2;
}

/**
 * Validates if a string matches the 'MM/DD/YYYY HH:MM AM/PM' date format.
 * @param {string} textContent The string to validate.
 * @returns {boolean} `true` if the string matches the format, otherwise `false`.
 */
export function isValidDateFormat(textContent) {
    const datePattern = /^(1[0-2]|0?[1-9])\/(3[01]|[12][0-9]|0?[1-9])\/\d{4} (1[0-2]|0?[1-9]):([0-5][0-9]) (AM|PM)$/;
    return datePattern.test(textContent);
}

/**
 * Validates if a string matches the 'DD/MM/YYYY HH:MM AM/PM' date format.
 * @param {string} textContent The string to validate.
 * @returns {boolean} `true` if the string matches the format, otherwise `false`.
 */
export function isValidDateFormat2(textContent) {
    const datePattern = /^(3[01]|[12][0-9]|0?[1-9])\/(1[0-2]|0?[1-9])\/\d{4} (1[0-2]|0?[1-9]):([0-5][0-9]) (AM|PM)$/;
    return datePattern.test(textContent);
}

/**
 * Validates if a string matches the 'DD/MM/YYYY HH:MM' (24-hour) date format.
 * @param {string} textContent The string to validate.
 * @returns {boolean} `true` if the string matches the format, otherwise `false`.
 */
export function isValidDateFormatDDMMnoAMPM(textContent) {
    const datePattern = /^(0?[1-9]|[12][0-9]|3[01])\/(0?[1-9]|1[012])\/\d{4} ([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return datePattern.test(textContent);
}

/**
 * Validates if a string matches the 'MM/DD/YYYY HH:MM' (24-hour) date format.
 * @param {string} textContent The string to validate.
 * @returns {boolean} `true` if the string matches the format, otherwise `false`.
 */
export function isValidDateFormatMMDDnoAMPM(textContent) {
    const datePattern = /^(0?[1-9]|1[0-2])\/(0?[1-9]|[12][0-9]|3[01])\/\d{4} ([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return datePattern.test(textContent);
}

/**
 * Converts a 'DD/MM/YYYY' date string to 'MM/DD/YYYY' format for consistent parsing.
 * @param {string} inputDate The date string in 'DD/MM/YYYY...' format.
 * @returns {string} The formatted date string in 'MM/DD/YYYY...' format.
 */
export function convertDateFormat2(inputDate) {
    const [datePart, timePart, isAmPm] = inputDate.split(' ');
    const [day, month, year] = datePart.split('/');
    return `${month}/${day}/${year} ${timePart} ${isAmPm}`;
}

/**
 * Gets the current day of the month.
 * @returns {number} The current day (1-31).
 */
function getDayOfMonth() {
    return new Date().getDate();
}

/**
 * Gets the current month.
 * @returns {number} The current month (1-12).
 */
function getCurrentMonth() {
    return new Date().getMonth() + 1;
}

/**
 * Converts a 'DD/MM/YYYY HH:MM' (24-hour) string to a standard 'MM/DD/YYYY HH:MM AM/PM' string.
 * @param {string} dateString The date string to convert.
 * @returns {string} The converted date string.
 */
export function convertDateFormatDDMMwithAMPM(dateString) {
    const [datePart, timePart] = dateString.split(' ');
    const [day, month, year] = datePart.split('/').map(Number);
    const [hours, minutes] = timePart.split(':').map(Number);
    const date = new Date(year, month - 1, day, hours, minutes);
    const hours12 = date.getHours() % 12 || 12;
    const amPm = date.getHours() < 12 ? 'AM' : 'PM';
    return `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}/${year} ${String(hours12).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${amPm}`;
}

/**
 * Converts a 'MM/DD/YYYY HH:MM' (24-hour) string to a standard 'MM/DD/YYYY HH:MM AM/PM' string.
 * @param {string} dateString The date string to convert.
 * @returns {string} The converted date string.
 */
export function convertDateFormatMMDDwithAMPM(dateString) {
    const [datePart, timePart] = dateString.split(' ');
    const [month, day, year] = datePart.split('/');
    const [hours, minutes] = timePart.split(':');
    const date = new Date(year, month - 1, day, hours, minutes);
    return date.toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
}

/**
 * Intelligently converts an ambiguous 'D/M/YYYY' or 'M/D/YYYY' format to a standard 'MM/DD/YYYY' format.
 * @description It resolves ambiguity by comparing the first two date parts to the current day and month,
 * making an educated guess as to which is the day and which is the month.
 * @param {string} inputDate The ambiguous date string.
 * @returns {string} The standardized date string.
 */
export function convertDateFormat(inputDate) {
    const [datePart, timePart, isAmPm] = inputDate.split(' ');
    const [firstDatePart, secondDatePart, year] = datePart.split('/');
    const currentDayOfMonth = getDayOfMonth();
    const currentMonth = getCurrentMonth();
    let day, month;
    if ((firstDatePart == currentDayOfMonth) && (secondDatePart == currentMonth)) {
        day = firstDatePart;
        month = secondDatePart;
    } else if ((firstDatePart == currentMonth) && (secondDatePart == currentDayOfMonth)) {
        day = secondDatePart;
        month = firstDatePart;
    } else if ((firstDatePart > 12) && (secondDatePart <= 12)) {
        day = firstDatePart;
        month = secondDatePart;
    } else if ((firstDatePart <= 12) && (secondDatePart > 12)) {
        day = secondDatePart;
        month = firstDatePart;
    } else {
        month = firstDatePart;
        day = secondDatePart;
    }
    return `${month}/${day}/${year} ${timePart} ${isAmPm}`;
}