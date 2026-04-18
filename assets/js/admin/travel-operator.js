jQuery(function() {
    clearAllFilterInput();
});

$(document).on("input", "#email-filter-input", function () {
    let email = $("#email-filter-input").val();
    email = email.trim();
    if (email) {
        $("#apply-email-filter").removeClass("btn-disabled");
        $("#clear-email-filter").removeClass("d-none");
    } else {
        $("#apply-email-filter").addClass("btn-disabled");
        $("#clear-email-filter").addClass("d-none");
    }
});

$(document).on("click", "#apply-email-filter", function () {
    const email = $("#email-filter-input").val().trim();
    let displayEmail = email.length > 15 ? email.substring(0, 15) + "..." : email;
    $("#email-filter-btn .filter-data").text(displayEmail).addClass("active");
    $("#email-filter-btn .hr-line-sm").addClass("active");
    $("#clear-email-filter").removeClass("d-none");
    
    let objectData = {
        email: email,
    };

    setFilters(objectData);
    filterData("/admin/travel-operator-filter");
    toggleResetButtonVisibility()
});

$(document).on("click", "#clear-email-filter", function () {
    $("#email-filter-input").val("");
    
    $("#apply-email-filter").addClass("btn-disabled");
    $("#email-filter-btn .filter-data").text("").removeClass("active");
    $("#email-filter-btn .hr-line-sm").removeClass("active");
    $("#clear-email-filter").addClass("d-none");
    
    let objectData = {
        email: "",
    };

    setFilters(objectData);
    filterData("/admin/travel-operator-filter");
    toggleResetButtonVisibility()
});

$(document).on("keypress", "#number-filter-input", function (e) {
    if (e.which < 48 || e.which > 57) {
        e.preventDefault();
    }
});

$(document).on("input", "#name-filter-input", function () {
    let userName = $("#name-filter-input").val();
    userName = userName.trim();
    if (userName) {
        $("#apply-name-filter").removeClass("btn-disabled");
        $("#clear-name-filter").removeClass("d-none");
    } else {
        $("#apply-name-filter").addClass("btn-disabled");
        $("#clear-name-filter").addClass("d-none");
    };
});

$(document).on("click", "#apply-name-filter", function () {
    const userName = $("#name-filter-input").val().trim();
    let displayUserName = userName.length > 15 ? userName.substring(0, 15) + "..." : userName;
    $("#name-filter-btn .filter-data").text(displayUserName).addClass("active");
    $("#name-filter-btn .hr-line-sm").addClass("active");
    $("#clear-name-filter").removeClass("d-none");

    let objectData = {
        userName: userName,
    };

    setFilters(objectData);
    filterData("/admin/travel-operator-filter");
    toggleResetButtonVisibility()
});

$(document).on("click", "#clear-name-filter", function () {
    $("#name-filter-input").val("");

    $("#apply-name-filter").addClass("btn-disabled");
    $("#name-filter-btn .filter-data").text("").removeClass("active");
    $("#name-filter-btn .hr-line-sm").removeClass("active");
    $("#clear-name-filter").addClass("d-none");

    let objectData = {
        userName: "",
    };

    setFilters(objectData);
    filterData("/admin/travel-operator-filter");

    toggleResetButtonVisibility()
});

$(document).on("input", "#number-filter-input", function () {
    let phoneNo = $("#number-filter-input").val();
    let digitsOnly = phoneNo.replace(/\D/g, '').slice(0, 12);
    this.value = digitsOnly;

    if (digitsOnly.length > 0) {
        $("#apply-number-filter").removeClass("btn-disabled");
        $("#clear-number-filter").removeClass("d-none");
    } else {
        $("#apply-number-filter").addClass("btn-disabled");
        $("#clear-number-filter").addClass("d-none");
    };
});

$(document).on("click", "#apply-number-filter", function () {
    const phoneNo = parseFloat($("#number-filter-input").val());

    $("#number-filter-btn .filter-data").text(phoneNo).addClass("active");
    $("#number-filter-btn .hr-line-sm").addClass("active");
    $("#clear-number-filter").removeClass("d-none");

    let objectData = {
        phoneNo: phoneNo,
    };

    setFilters(objectData);
    filterData("/admin/travel-operator-filter");
    toggleResetButtonVisibility()
});

$(document).on("click", "#clear-number-filter", function () {
    $("#number-filter-input").val("");

    $("#apply-number-filter").addClass("btn-disabled");
    $("#number-filter-btn .filter-data").text("").removeClass("active");
    $("#number-filter-btn .hr-line-sm").removeClass("active");
    $("#clear-number-filter").addClass("d-none");

    let objectData = {
        phoneNo: "",
    };

    setFilters(objectData);
    filterData("/admin/travel-operator-filter");
    toggleResetButtonVisibility();
});

$(document).on("click", ".change_user_status", function () {
    let status_val = $(this).data("status");
    let status_text_val = $(this).data("status-text");

    $(".change_user_status").removeClass("active");
    $("#clear_user_status_filter").removeClass("btn-disabled");
    $("#user_status_btn.hr-line-sm").addClass("active");
    $("#user_status_btn .filter-data").text(status_text_val).addClass("active");
    $(this).addClass("active");

    let objectData = {
        status: parseInt(status_val),
    };
    setFilters(objectData);
    filterData("/admin/travel-operator-filter");
    toggleResetButtonVisibility();
});

$(document).on("click", "#clear_user_status_filter", function () {
    $(this).addClass("btn-disabled");
    $(".change_user_status").removeClass("active");
    $("#user_status_btn .hr-line-sm").removeClass("active");
    $("#user_status_btn .filter-data").text("").removeClass("active");

    let objectData = {
        status: "",
    };

    setFilters(objectData);
    filterData("/admin/travel-operator-filter");
    toggleResetButtonVisibility();
});

$(document).on("click", ".f-reset-btn", function() {
    clearAllFilterInput();
});

function clearAllFilterInput() {
    $("#email-filter-input").val('').trigger("input");
    $("#name-filter-input").val('').trigger("input");
    $("#number-filter-input").val('').trigger("input");
    $(".f-reset-btn").addClass("d-none");
    $("#email-filter-btn .filter-data").removeClass("active").text('');
    $("#email-filter-btn .hr-line-sm").removeClass("active");
    $("#name-filter-btn .filter-data").removeClass("active").text('');
    $("#name-filter-btn .hr-line-sm").removeClass("active");
    $("#number-filter-btn .filter-data").removeClass("active").text('');
    $("#number-filter-btn .hr-line-sm").removeClass("active");
    $("#clear-email-filter").addClass("d-none");
    $("#clear-name-filter").addClass("d-none");
    $("#clear-number-filter").addClass("d-none");
    $(".change_user_status").removeClass("active");
    $("#user_status_btn .hr-line-sm").removeClass("active");
    $("#user_status_btn .filter-data").text("").removeClass("active");

    let objectData = {
        email: "",
        phoneNo: "",
        userName: "",
        status:"",
    };

    setFilters(objectData);
    filterData("/admin/travel-operator-filter");
}

function toggleResetButtonVisibility() {
    const hasActiveFilters = $(".filter-btn .filter-data.active").text().trim() !== "";

    if (hasActiveFilters) {
        $(".f-reset-btn").removeClass("d-none");
    } else {
        $(".f-reset-btn").addClass("d-none");
    };
};
