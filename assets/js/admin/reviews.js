jQuery(function() {
    filterData("/admin/review-filter");
});

$(document).on("input", "#activity_name_filter_input", function () {
    let activityName = $(this).val();
    activityName = activityName.trim();
    if (activityName) {
        $("#apply_activity_name_filter").removeClass("btn-disabled");
        $("#clear_activity_name_filter").removeClass("d-none");
    } else {
        $("#apply_activity_name_filter").addClass("btn-disabled");
        $("#clear_activity_name_filter").addClass("d-none");
    }
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
    filterData("/admin/review-filter");
    toggleResetButtonVisibility()
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
    filterData("/admin/review-filter");
    toggleResetButtonVisibility()
});

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
    let displaytravelOperatorName = travelOperatorName.length > 15 ? travelOperatorName.substring(0, 15) + "..." : travelOperatorName;
    $("#activity_operator_name_filter_btn .filter-data").text(displaytravelOperatorName).addClass("active");
    $("#activity_operator_name_filter_btn .hr-line-sm").addClass("active");
    $("#clear_travel_operator_filter").removeClass("d-none");

    let objectData = {
        travelOperatorName: travelOperatorName,
    };

    setFilters(objectData);
    filterData("/admin/review-filter");
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
    filterData("/admin/review-filter");
    toggleResetButtonVisibility()
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
    }
});
$(document).on("click", "#apply-name-filter", function () {
    const userName = $("#name-filter-input").val().trim();
    let displayuserName = userName.length > 15 ? userName.substring(0, 15) + "..." : userName;
    $("#name-filter-btn .filter-data").text(displayuserName).addClass("active");
    $("#name-filter-btn .hr-line-sm").addClass("active");
    $("#clear-name-filter").removeClass("d-none");

    let objectData = {
        userName: userName,  
    };

    setFilters(objectData);  
    filterData("/admin/review-filter");  
    toggleResetButtonVisibility();  
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
    filterData("/admin/review-filter");  

    toggleResetButtonVisibility();  
});

$(document).on("click", ".f-reset-btn", function() {
    $("#activity_name_filter_input").val('').trigger("input");
    $("#travel_operator_filter_input").val('').trigger("input");
    $("#name-filter-input").val('').trigger("input");

    $(".f-reset-btn").addClass("d-none");  
    $("#activity_name_filter_btn .filter-data").removeClass("active").text('');
    $("#activity_name_filter_btn .hr-line-sm").removeClass("active");
    $("#activity_operator_name_filter_btn .filter-data").removeClass("active").text('');
    $("#activity_operator_name_filter_btn .hr-line-sm").removeClass("active");
    $("#name-filter-btn .filter-data").removeClass("active").text('');
    $("#name-filter-btn .hr-line-sm").removeClass("active");
    $("#clear_activity_name_filter").addClass("d-none");
    $("#clear_travel_operator_filter").addClass("d-none");
    $("#clear-name-filter").addClass("d-none");

    let objectData = {
        activityName: "",
        travelOperatorName: "",
        userName: "",  
    };

    setFilters(objectData);  
    filterData("/admin/review-filter"); 
});

$(document).on("click", "#review-btn", function () {
    const activity = $(this).data('activity');
    const review = $(this).data('review');
    const ratings = $(this).data('ratings');
    const userName = $(this).data('username');
    const operatorName = $(this).data('operatorname');
    const tripDate = $(this).data('tripdate');

    function formatDate(date) {
        if (!date || date === "-") return "-"; 
        let d = new Date(date);
        if (isNaN(d.getTime())) return "-"; 
        let day = ("0" + d.getDate()).slice(-2); 
        let month = ("0" + (d.getMonth() + 1)).slice(-2);  
        let year = d.getFullYear();
        return `${day}-${month}-${year}`;
    }

    const formattedTripDate = formatDate(tripDate);

    $("#activity").text(activity);     
    $("#review").text(review);         
    $("#ratings").text(ratings);        
    $("#operatorname").text(operatorName); 
    $("#username").text(userName);
    $("#tripdate").text(formattedTripDate);  
    $("#reviewModal").modal('show');
});

function toggleResetButtonVisibility() {
    const hasActiveFilters = $(".filter-btn .filter-data.active").text().trim() !== "";

    if (hasActiveFilters) {
        $(".f-reset-btn").removeClass("d-none");
    } else {
        $(".f-reset-btn").addClass("d-none");
    };
};
