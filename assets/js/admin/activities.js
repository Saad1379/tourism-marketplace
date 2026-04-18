jQuery(function() {
    filterData("/admin/travel-activity-filter");
});

// Activity Name Filter
$(document).on("input", "#activity_name_filter_input", function () {
    let activityName = $(this).val();
    activityName = activityName.trim();
    if (activityName) {
        $("#apply_activity_name_filter").removeClass("btn-disabled");
        $("#clear_activity_name_filter").removeClass("d-none");
    } else {
        $("#apply_activity_name_filter").addClass("btn-disabled");
        $("#clear_activity_name_filter").addClass("d-none");
    };
});

$(document).on("click", "#apply_activity_name_filter", function () {
    const activityName = $("#activity_name_filter_input").val().trim();
    let displayActivityName = activityName.length > 15 ? activityName.substring(0, 15) + "..." : activityName;

    $("#activity_name_filter_btn .filter-data").text(displayActivityName).addClass("active");
    $("#activity_name_filter_btn .hr-line-sm").addClass("active");
    $("#clear_activity_name_filter").removeClass("d-none");

    let objectData = {
        activityName: activityName,
    };

    setFilters(objectData);
    filterData("/admin/travel-activity-filter");
    toggleResetButtonVisibility();
});

$(document).on("click", "#clear_activity_name_filter", function () {
    $("#activity_name_filter_input").val("");

    $("#apply_activity_name_filter").addClass("btn-disabled");
    $("#activity_name_filter_btn .filter-data").text("").removeClass("active");
    $("#activity_name_filter_btn .hr-line-sm").removeClass("active");
    $(this).addClass("d-none");

    let objectData = {
        activityName: "",
    };

    setFilters(objectData);
    filterData("/admin/travel-activity-filter");
    toggleResetButtonVisibility()
});

// Travel Operator Name Filter
$(document).on("input", "#travel_operator_filter_input", function () {
    let travelOperatorName = $(this).val();
    travelOperatorName = travelOperatorName.trim();

    if (travelOperatorName) {
        $("#apply_travel_operator_filter").removeClass("btn-disabled");
        $("#clear_travel_operator_filter").removeClass("d-none");
    } else {
        $("#apply_travel_operator_filter").addClass("btn-disabled");
        $("#clear_travel_operator_filter").addClass("d-none");
    };
});

$(document).on("click", "#apply_travel_operator_filter", function () {
    const travelOperatorName = $("#travel_operator_filter_input").val().trim();
    let displayTravelOperatorName = travelOperatorName.length > 15 ? travelOperatorName.substring(0, 15) + "..." : travelOperatorName;
    $("#activity_operator_name_filter_btn .filter-data").text(displayTravelOperatorName).addClass("active");
    $("#activity_operator_name_filter_btn .hr-line-sm").addClass("active");
    $("#clear_travel_operator_filter").removeClass("d-none");

    let objectData = {
        travelOperatorName: travelOperatorName,
    };

    setFilters(objectData);
    filterData("/admin/travel-activity-filter");
    toggleResetButtonVisibility();
});

$(document).on("click", "#clear_travel_operator_filter", function () {
    $("#travel_operator_filter_input").val("");

    $("#apply_travel_operator_filter").addClass("btn-disabled");
    $("#activity_operator_name_filter_btn .filter-data").text("").removeClass("active");
    $("#activity_operator_name_filter_btn .hr-line-sm").removeClass("active");
    $("#clear_travel_operator_filter").addClass("d-none");

    let objectData = {
        travelOperatorName: "",
    };

    setFilters(objectData);
    filterData("/admin/travel-activity-filter");

    toggleResetButtonVisibility()
});

$(document).on("click", ".change_activity_status", function () {
    let status_val = $(this).data("status");
    let status_text_val = $(this).data("status-text");

    $(".change_activity_status").removeClass("active");
    $("#clear_activity_status_filter").removeClass("btn-disabled");
    $("#activity_status_btn .hr-line-sm").addClass("active");
    $("#activity_status_btn .filter-data").text(status_text_val).addClass("active");
    $(this).addClass("active");

    let objectData = {
        status: parseInt(status_val),
    };
    setFilters(objectData);
    filterData("/admin/travel-activity-filter");
    toggleResetButtonVisibility();
});

$(document).on("click", "#clear_activity_status_filter", function () {
    $(this).addClass("btn-disabled");
    $(".change_activity_status").removeClass("active");
    $("#activity_status_btn .hr-line-sm").removeClass("active");
    $("#activity_status_btn .filter-data").text("").removeClass("active");

    let objectData = {
        status: "",
    };

    setFilters(objectData);
    filterData("/admin/travel-activity-filter");
    toggleResetButtonVisibility();
});

$(document).on("click", ".change_activity_view_status", function () {
    let view_status_val = $(this).data("view-status");
    let view_status_text_val = $(this).data("view-status-text");

    $(".change_activity_view_status").removeClass("active");
    $("#clear_activity_view_status_filter").removeClass("btn-disabled");
    $("#activity_view_status_btn .hr-line-sm").addClass("active");
    $("#activity_view_status_btn .filter-data").text(view_status_text_val).addClass("active");
    $(this).addClass("active");

    let objectData = {
        view_status: parseInt(view_status_val),
    };
    setFilters(objectData);
    filterData("/admin/travel-activity-filter");
    toggleResetButtonVisibility();
});

$(document).on("click", "#clear_activity_view_status_filter", function () {
    $(this).addClass("btn-disabled");
    $(".change_activity_view_status").removeClass("active");
    $("#activity_view_status_btn .hr-line-sm").removeClass("active");
    $("#activity_view_status_btn .filter-data").text("").removeClass("active");

    let objectData = {
        view_status: "",
    };

    setFilters(objectData);
    filterData("/admin/travel-activity-filter");
    toggleResetButtonVisibility();
});

$(document).on("click", ".f-reset-btn", function() {
    $("#activity_name_filter_input").val('').trigger("input");
    $("#travel_operator_filter_input").val('').trigger("input");
    $(".f-reset-btn").addClass("d-none");
    $("#activity_name_filter_btn .filter-data").removeClass("active").text('');
    $("#activity_name_filter_btn .hr-line-sm").removeClass("active");
    $("#activity_operator_name_filter_btn .filter-data").removeClass("active").text('');
    $("#activity_operator_name_filter_btn .hr-line-sm").removeClass("active");
    $("#clear_activity_name_filter").addClass("d-none");
    $("#clear_travel_operator_filter").addClass("d-none");
    $("#activity_status_btn .hr-line-sm").removeClass("active");
    $("#activity_status_btn .filter-data").text("").removeClass("active");
    $("#clear_activity_status_filter").addClass("btn-disabled");
    $("#activity_view_status_btn .hr-line-sm").removeClass("active");
    $("#activity_view_status_btn .filter-data").text("").removeClass("active");
    $("#clear_activity_view_status_filter").addClass("btn-disabled");

    let objectData = {
        activityName: "",
        travelOperatorName: "",
        status:"",
        view_status:"",
    };

    setFilters(objectData);
    filterData("/admin/travel-activity-filter");
});

function toggleResetButtonVisibility() {
    const hasActiveFilters = $(".filter-btn .filter-data.active").text().trim() !== "";

    if (hasActiveFilters) {
        $(".f-reset-btn").removeClass("d-none");
    } else {
        $(".f-reset-btn").addClass("d-none");
    };
};
