import registerBar from '../lib/bar-host';

/**
 * Injected on first invoke, never at page load: React and the bar are the bulk of the extension,
 * and nothing about them belongs in the content script's budget.
 */
export default defineUnlistedScript(registerBar);
