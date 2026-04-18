// Slider-============
document.addEventListener("DOMContentLoaded", function () {
    const toggleSidebarBtn = document.querySelector(".dash-button");
    const sideWrapper = document.querySelector(".dash-wrapper");

    if (toggleSidebarBtn) {
        toggleSidebarBtn.addEventListener("click", function (e) {
            sideWrapper.classList.toggle("toggle-sidebar");
        });
    };
});

// Currency Selector====
$(".dropdown-item").on("click", function () {
    const selectedCurrencyElement = $("#selected-currency");

    selectedCurrencyElement.text($(this).data("currency"));
    selectedCurrencyElement.attr("data-currency-name", $(this).data("currency"));
    selectedCurrencyElement.attr("data-currency-type", $(this).data("currency-type"));

    $("#currencySecond img").attr("src", $(this).data("flag"));
});


// Accordion
const headers = document.querySelectorAll(".acc-header");
if(headers){
    headers.forEach((header) => {
        header.addEventListener("click", () => {
          header.parentElement.classList.toggle("open");
        });
    });
};
