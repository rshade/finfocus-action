export const id = 617;
export const ids = [617];
export const modules = {

/***/ 6617:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   checkCarbonThreshold: () => (/* binding */ checkCarbonThreshold),
/* harmony export */   checkThreshold: () => (/* binding */ checkThreshold)
/* harmony export */ });
/* harmony import */ var _actions_core__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(7484);
/* harmony import */ var _actions_core__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_actions_core__WEBPACK_IMPORTED_MODULE_0__);

function checkThreshold(threshold, diff, currency) {
    if (!threshold)
        return false;
    const regex = /^(\d+(\.\d{1,2})?)([A-Z]{3})$/;
    const match = threshold.match(regex);
    if (!match) {
        _actions_core__WEBPACK_IMPORTED_MODULE_0__.warning(`Malformed threshold input: "${threshold}". Expected format like "100USD". Skipping guardrail.`);
        return false;
    }
    const limitValue = parseFloat(match[1]);
    const limitCurrency = match[3];
    if (limitCurrency !== currency) {
        _actions_core__WEBPACK_IMPORTED_MODULE_0__.warning(`Currency mismatch in threshold. Threshold: ${limitCurrency}, Report: ${currency}. Skipping guardrail.`);
        return false;
    }
    if (diff > limitValue) {
        return true;
    }
    return false;
}
function checkCarbonThreshold(threshold, diff, baseTotal) {
    if (!threshold)
        return false;
    // Pattern for absolute: "10kg", "10.5kgCO2e", etc.
    // Pattern for percent: "10%"
    const absRegex = /^(\d+(\.\d{1,2})?)(kg|kgCO2e)?$/i;
    const pctRegex = /^(\d+(\.\d{1,2})?)%$/;
    const absMatch = threshold.match(absRegex);
    const pctMatch = threshold.match(pctRegex);
    if (absMatch) {
        const limitValue = parseFloat(absMatch[1]);
        return diff > limitValue;
    }
    if (pctMatch) {
        const limitPct = parseFloat(pctMatch[1]);
        if (baseTotal <= 0)
            return false; // Avoid division by zero or nonsensical checks
        const currentPct = (diff / baseTotal) * 100;
        return currentPct > limitPct;
    }
    _actions_core__WEBPACK_IMPORTED_MODULE_0__.warning(`Malformed carbon threshold input: "${threshold}". Expected format like "10kg" or "10%". Skipping guardrail.`);
    return false;
}


/***/ })

};

//# sourceMappingURL=617.index.js.map