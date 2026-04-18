jQuery(function() {
    filterData("/admin/refund-request-filter");
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
    filterData("/admin/refund-request-filter");
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
    filterData("/admin/refund-request-filter");
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
    filterData("/admin/refund-request-filter");
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
    filterData("/admin/refund-request-filter");
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
    filterData("/admin/refund-request-filter");
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
    filterData("/admin/refund-request-filter");
    toggleResetButtonVisibility();  
});

$(document).on("click", ".change_customer_status", function () {
    let status_val = $(this).data("status");
    let status_text_val = $(this).data("status-text");

    $(".change_customer_status").removeClass("active");
    $("#clear_customer_status_filter").removeClass("btn-disabled");
    $("#customer_status_btn.hr-line-sm").addClass("active");
    $("#customer_status_btn .filter-data").text(status_text_val).addClass("active");
    $(this).addClass("active");

    let objectData = {
        status: parseInt(status_val),
    };
    setFilters(objectData);
    filterData("/admin/refund-request-filter");
    toggleResetButtonVisibility();
});

$(document).on("click", "#clear_customer_status_filter", function () {
    $(this).addClass("btn-disabled");
    $(".change_customer_status").removeClass("active");
    $("#customer_status_btn .hr-line-sm").removeClass("active");
    $("#customer_status_btn .filter-data").text("").removeClass("active");

    let objectData = {
        status: "",
    };

    setFilters(objectData);
    filterData("/admin/refund-request-filter");
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
    $("#customer_status_btn .hr-line-sm").removeClass("active");
    $("#customer_status_btn .filter-data").text("").removeClass("active");

    let objectData = {
        activityName: "",
        travelOperatorName: "",
        userName: "", 
        status 
    };

    setFilters(objectData);  
    filterData("/admin/refund-request-filter");
});

$(document).on("click", "#refund-btn", function () {
    $("#customer_refund_request_id").val("");
    $("#customer_user_id").val("");
    $("#customer_booking_amount").val("");

    const userId = $(this).data('userid');
    const activity = $(this).data('activity');
    const userName = $(this).data('username');
    const operatorName = $(this).data('operatorname');
    const tripDate = $(this).data('tripdate');
    const status = $(this).data('status');
    const amount = $(this).data('amount');
    const reason = $(this).data('reason');
    const cancelDescription = $(this).data('cancel-description');
    const refundRequestId = $(this).data('refund-request-id')
    const date = $(this).data('date');

    const formattedTripDate = formatDate(tripDate);
    const formattedcreatedAt = formatDate(date);

    $("#customer_refund_request_id").val(refundRequestId);
    $("#customer_user_id").val(userId);
    $("#customer_booking_amount").val(amount);

    $("#activity-refund").text(activity);
    $("#operatorname-refund").text(operatorName);
    $("#username-refund").text(userName);
    $("#tripdate-refund").text(formattedTripDate);
    $("#amount").text(amount);
    $("#reason").text(reason);
    $("#cancel_description").text(cancelDescription);
    $("#date").text(formattedcreatedAt);

    let statusText = '';
    switch (status) {
        case 1:
            statusText = 'Pending';
            break;
        case 2:
            statusText = 'Completed';
            break;
        case 3:
            statusText = 'Rejected';
            break;
        default:
            statusText = 'Unknown Status';
    }

    $("#status").text(statusText);
    $("#customerRefundModal").modal('show'); 
});

$(".update_refund_status").on("click", function () {
    let status = $(this).data("status");
    let refundRequestId = $("#customer_refund_request_id").val();
    let userId = $("#customer_user_id").val();
    let amount = $("#customer_booking_amount").val();

    let payload = {
        refundRequestId: refundRequestId,
        userId: userId,
        amount: parseFloat(amount),
        status: parseInt(status),
    };

    postAjaxCall("/admin/update-refund-status", payload, function (res) {
        showToast(res.flag, res.msg);
        if (res.flag === 1) {
            if(parseInt(status) === 2){
                setTimeout(() => {
                    $("#customerRefundModal").modal('hide');
                }, 400);
                setTimeout(() => {
                    $("#refund-request-approve").modal('show');
                }, 500);
            } else {
                setTimeout(() => {
                    location.reload(1);
                }, 1000);
            };
        };
    });
});

$(document).on("click", "#refund-btn-status", function () {  
    const activity = $(this).data('activity');
    const userName = $(this).data('username');
    const operatorName = $(this).data('operatorname');
    const tripDate = $(this).data('tripdate');
    const status = $(this).data('status');
    const amount = $(this).data('amount');
    const reason = $(this).data('reason');
    const cancelDescription = $(this).data('cancel-description');
    const date = $(this).data('date');

    const formattedTripDate = formatDate(tripDate);
    const formattedcreatedAt = formatDate(date)

    $("#activity-refund-view").text(activity);           
    $("#operatorname-refund-view").text(operatorName); 
    $("#username-refund-view").text(userName);
    $("#tripdate-refund-view").text(formattedTripDate); 
    $("#amount-view").text(`$ ${amount}`);
    $("#reason-view").text(reason ? reason : "NA");
    $("#description-view").text(cancelDescription ? cancelDescription : "NA");
    $("#date-view").text(formattedcreatedAt);

    let statusText = '';
    switch (status) {
        case 1:
            statusText = 'Pending';
            break;
        case 2:
            statusText = 'Completed';
            break;
        case 3:
            statusText = 'Rejected';
            break;
        default:
            statusText = 'Unknown Status';
    }

    $("#status-view").text(statusText); 
    $("#customerRefundModalView").modal('show'); 
});

function formatDate(date) {
    let d = new Date(date);
    let day = ("0" + d.getDate()).slice(-2);
    let month = ("0" + (d.getMonth() + 1)).slice(-2);
    let year = d.getFullYear();
    return `${day}-${month}-${year}`;
};

function toggleResetButtonVisibility() {
    const hasActiveFilters = $(".filter-btn .filter-data.active").text().trim() !== "";

    if (hasActiveFilters) {
        $(".f-reset-btn").removeClass("d-none");
    } else {
        $(".f-reset-btn").addClass("d-none");
    }
};
