var flat_datepickr;
jQuery(function() {
    flat_datepickr = flatpickr("#datepicker", {
        // minDate: "today",
        defaultDate: new Date(),
        clickOpens: false,
        onChange: function(selectedDates, dateStr, instance) {
            $("#datepicker").val("");
            let date = selectedDates[0];
            let formattedDate = shortDateFormat(date);
            $("#trip_date_btn .hr-line-sm").addClass("active");
            $("#trip_date_btn .filter-data").text(formattedDate).addClass("active");
            $("#clear_trip_status_filter").removeClass("btn-disabled");

            // Remove previous highlight
            instance.calendarContainer.querySelectorAll(".highlight-selected-date").forEach(el => {
                el.classList.remove("highlight-selected-date");
            });

            // Add highlight to selected date
            let dayElements = instance.calendarContainer.querySelectorAll(".flatpickr-day");
            dayElements.forEach(dayElem => {
                let current = dayElem.dateObj;
                if (
                    current.getDate() === date.getDate() &&
                    current.getMonth() === date.getMonth() &&
                    current.getFullYear() === date.getFullYear()
                ) {
                    dayElem.classList.add("highlight-selected-date");
                };
            });

            let d = new Date(date);
            let year = d.getFullYear();
            let month = (d.getMonth() + 1).toString().padStart(2, '0'); // months are 0-indexed
            let day = d.getDate().toString().padStart(2, '0');

            let trip_date = `${year}-${month}-${day}`;

            let objectData = {
                tripDate: trip_date,
            };
            setFilters(objectData);
            filterData("/admin/bookings-history-filter");
            toggleResetButtonVisibility();
        },
        onDayCreate: function(dObj, dStr, fp, dayElem) {
            let highlightDate = new Date();
            let current = dayElem.dateObj;

            if (
                highlightDate.getDate() === current.getDate() &&
                highlightDate.getMonth() === current.getMonth() &&
                highlightDate.getFullYear() === current.getFullYear()
            ) {
                dayElem.classList.add("highlight-selected-date");
            };
        },
    });
    filterData("/admin/bookings-history-filter");
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
    filterData("/admin/bookings-history-filter");
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
    filterData("/admin/bookings-history-filter");
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
    let displayTravelOperatorName = travelOperatorName.length > 15 ? travelOperatorName.substring(0, 15) + "..." : travelOperatorName;
    $("#activity_operator_name_filter_btn .filter-data").text(displayTravelOperatorName).addClass("active");
    $("#activity_operator_name_filter_btn .hr-line-sm").addClass("active");
    $("#clear_travel_operator_filter").removeClass("d-none");

    let objectData = {
        travelOperatorName: travelOperatorName,
    };

    setFilters(objectData);
    filterData("/admin/bookings-history-filter");
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
    filterData("/admin/bookings-history-filter");
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
    let displayUserName = userName.length > 15 ? userName.substring(0, 15) + "..." : userName;
    $("#name-filter-btn .filter-data").text(displayUserName).addClass("active");
    $("#name-filter-btn .hr-line-sm").addClass("active");
    $("#clear-name-filter").removeClass("d-none");

    let objectData = {
        userName: userName,  
    };

    setFilters(objectData);  
    filterData("/admin/bookings-history-filter");
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
    filterData("/admin/bookings-history-filter");
    toggleResetButtonVisibility();  
});

$(document).on("click", ".change_payment_status", function () {
    let status_val = $(this).data("status");
    let status_text_val = $(this).data("status-text");

    $(".change_payment_status").removeClass("active");
    $("#clear_payment_status_filter").removeClass("btn-disabled");
    $("#payment_status_btn .hr-line-sm").addClass("active");
    $("#payment_status_btn .filter-data").text(status_text_val).addClass("active");
    $(this).addClass("active");

    let objectData = {
        paymentStatus: parseInt(status_val),
    };
    setFilters(objectData);
    filterData("/admin/bookings-history-filter");
    toggleResetButtonVisibility();
});

$(document).on("click", "#clear_payment_status_filter", function () {
    $(this).addClass("btn-disabled");
    $(".change_payment_status").removeClass("active");
    $("#payment_status_btn .hr-line-sm").removeClass("active");
    $("#payment_status_btn .filter-data").text("").removeClass("active");

    let objectData = {
        paymentStatus: "",
    };

    setFilters(objectData);
    filterData("/admin/bookings-history-filter");
    toggleResetButtonVisibility();
});

$(document).on("click", ".change_trip_status", function () {
    let status_val = $(this).data("status");
    let status_text_val = $(this).data("status-text");

    $(".change_trip_status").removeClass("active");
    $("#clear_trip_status_filter").removeClass("btn-disabled");
    $("#trip_status_btn .hr-line-sm").addClass("active");
    $("#trip_status_btn .filter-data").text(status_text_val).addClass("active");
    $(this).addClass("active");

    let objectData = {
        tripStatus: parseInt(status_val),
    };
    setFilters(objectData);
    filterData("/admin/bookings-history-filter");
    toggleResetButtonVisibility();
});

$(document).on("click", "#clear_trip_status_filter", function () {
    $(this).addClass("btn-disabled");
    $(".change_trip_status").removeClass("active");
    $("#trip_status_btn .hr-line-sm").removeClass("active");
    $("#trip_status_btn .filter-data").text("").removeClass("active");

    let objectData = {
        tripStatus: "",
    };

    setFilters(objectData);
    filterData("/admin/bookings-history-filter");
    toggleResetButtonVisibility();
});

$("#trip_date_btn").on("click", function (e) {
    $(".flatpickr-calendar").addClass("custom-flatpickr");
    flat_datepickr.open();
});

$(document).on("click", ".f-reset-btn", function() {
    location.reload(1);
    // let today = new Date();
    // flat_datepickr.setDate(today, true);

    // $("#activity_name_filter_input").val('').trigger("input");
    // $("#travel_operator_filter_input").val('').trigger("input");
    // $("#name-filter-input").val('').trigger("input");

    // $(".f-reset-btn").addClass("d-none");  
    // $("#activity_name_filter_btn .filter-data").removeClass("active").text('');
    // $("#activity_name_filter_btn .hr-line-sm").removeClass("active");
    // $("#activity_operator_name_filter_btn .filter-data").removeClass("active").text('');
    // $("#activity_operator_name_filter_btn .hr-line-sm").removeClass("active");
    // $("#name-filter-btn .filter-data").removeClass("active").text('');
    // $("#name-filter-btn .hr-line-sm").removeClass("active");
    // $("#clear_activity_name_filter").addClass("d-none");
    // $("#clear_travel_operator_filter").addClass("d-none");
    // $("#clear-name-filter").addClass("d-none");
    // $(".change_payment_status").removeClass("active");
    // $("#payment_status_btn .hr-line-sm").removeClass("active");
    // $("#payment_status_btn .filter-data").text("").removeClass("active");
    // $(".change_trip_status").removeClass("active");
    // $("#trip_status_btn .hr-line-sm").removeClass("active");
    // $("#trip_status_btn .filter-data").text("").removeClass("active");
    // $("#trip_date_btn .hr-line-sm").removeClass("active");
    // $("#trip_date_btn .filter-data").text("").removeClass("active");

    // let objectData = {
    //     activityName: "",
    //     travelOperatorName: "",
    //     userName: "", 
    //     paymentStatus:"",
    //     tripStatus:"",
    //     tripDate:"",
    // };

    // setFilters(objectData);
    // filterData("/admin/bookings-history-filter");
    // toggleResetButtonVisibility();
});

function toggleResetButtonVisibility() {
    const hasActiveFilters = $(".filter-btn .filter-data.active").text().trim() !== "";

    if (hasActiveFilters) {
        $(".f-reset-btn").removeClass("d-none");
    } else {
        $(".f-reset-btn").addClass("d-none");
    }
}
