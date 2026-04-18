jQuery(function() {
    $("#clear_status_filter").addClass("btn-disabled");
    $("#withdraw_status_btn .hr-line-sm").removeClass("active");
    $("#withdraw_status_btn .filter-data").text("").removeClass("active");
    $("#clear_operator_activity_status_filter").addClass("btn-disabled");
    $("#operator_activity_status_btn .hr-line-sm").removeClass("active");
    $("#operator_activity_status_btn .filter-data").text("").removeClass("active");
    $("#clear_operator_booking_status_filter").addClass("btn-disabled");
    $("#operator_booking_status_btn .hr-line-sm").removeClass("active");
    $("#operator_booking_status_btn .filter-data").text("").removeClass("active");

    operatorActivityFilter({});
});

$(document).on("click", "#s-history-tab", function() {
    operatorActivityFilter({});
});

$(document).on("click", "#sb-listing-tab", function() {
    operatorBookingHistoryFilter({});
});

$(document).on("click", "#sb-setting-tab", function() {
    operatoUserRefundRequestFilter({})
});

$(document).on("click", "#sb-withdraw-tab", function() {
    withdrawRequestByOpertorFilter({});
});

$(document).on("click", "#edit-btn", function () {
    const userName = $(this).data('username');
    const userEmail = $(this).data('email');
    const userPhone = $(this).data('phonenumber');
    const profileImage = $(this).data('profileimage');

    $("#userName").val(userName);
    $("#userEmail").val(userEmail);
    $("#userPhone").val(userPhone);

    if (profileImage && profileImage.trim() !== '' && profileImage !== 'user_profile_dp.svg') {
        $("#profileImagePreview").attr("src", "/images/profileImages/" + profileImage.split('/').pop());
    } else {
        $("#profileImagePreview").attr("src", "/images/user_profile_dp.svg");
    };
    $("#editModal").modal('show');
});

$(document).on("click", "#editImageBtn", function() {
    $("#profileImage").click(); 
});

$("#profileImage").on("change", function(event) {
    const file = event.target.files[0];

    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            $("#profileImagePreview").attr("src", e.target.result); 
        };
        reader.readAsDataURL(file); 
    };
});

$(document).on("click", "#update-btn", function () {
    const updatedUser = {
        userId: $("#userId").val(),
        userName: $("#userName").val(),
        email: $("#userEmail").val(),
        phoneNo: $("#userPhone").val(),
        profileImage: $("#profileImagePreview").attr("src")
    };

    let validationMessage = "";
    const userName = updatedUser.userName;
    const phoneNo = updatedUser.phoneNo;
    let phoneNoPattern = /^\d+$/;
    let sanitizedPhoneNo = phoneNo.replace(/\D/g, '');

    if(!userName === '') {
        showToast(0, "Please enter full name");
        return false;
    };

    if(userName?.length < 3) {
        showToast(0, "Full name must be atleast 3 characters");
        return false;
    };

    if(userName?.length > 15) {
        showToast(0, "Name should not exceed 15 characters.");
        return false;
    };

    if(!sanitizedPhoneNo) {
        showToast(0, "Please enter phone number.");
        return false;
    };

    if(!phoneNoPattern.test(sanitizedPhoneNo)) {
        showToast(0, "Phone number must be numeric.");
        return false;
    };

    if(sanitizedPhoneNo?.length !== 10) {
        showToast(0, "Phone number must be 10 digits.");
        return false;
    };

    if (validationMessage) {
        showToast(0, validationMessage);
        return; 
    };

    const formData = new FormData();
    for (const key in updatedUser) {
        if (updatedUser.hasOwnProperty(key)) {
            formData.append(key, updatedUser[key]);
        };
    };

    const profileImageFile = $("#profileImage")[0].files[0];
    if (profileImageFile) {
        formData.append("profileImage", profileImageFile);
    };

    postFileCall("/admin/updateUserDetails", formData, function (res) {
        showToast(res.flag, res.msg);
        if (res.flag === 1) {
            setTimeout(function () {
                location.reload(1);
            }, 1500);
        };
    });
});

$(document).on("change", "#change_account_status", function () {
    const userId = $("#userId").val();
    const status = $(this).val();

    let infoText = "";
    let buttonText = "";
    let buttonClass = "";
    if (parseInt(status) === 3) {
        infoText = "Are you sure you wants to suspend this Operator?";
        buttonText = "Suspend";
        buttonClass = "btn-red";
    } else if (parseInt(status) === 2) {
        infoText = "Are you sure you wants to Active this Operator?";
        buttonText = "Active";
        buttonClass = "btn-green";
    } else if (parseInt(status) === 1) {
        infoText = "Are you sure you wants to InActive this Operator?";
        buttonText = "InActive";
        buttonClass = "btn-yellow";
    };

    $("#suspend_active_confirmation_modal #model_info_text").html(infoText);
    $("#suspend_active_confirmation_modal #confirm_update_status").html(buttonText);
    $("#suspend_active_confirmation_modal #confirm_update_status").addClass(buttonClass);
    $("#suspend_active_confirmation_modal").modal('show');
    window.pendingStatusUpdate = { status: status, userId: userId };
});

$("#confirm_update_status").on("click", function () {
    const { status, userId } = window.pendingStatusUpdate;
    postAjaxCall("/admin/update-user-status", { status: status, userId: userId }, function (res) {
        showToast(res.flag, res.msg);

        if (res.flag === 1) {
            $("#suspend_active_confirmation_modal").modal('hide');
            setTimeout(() => {
                location.reload();
            }, 1000);
        };
    });
});

$('#ey2').click(function() {
    let accountNumberVisible = $('#account-number-visible');
    let accountNumberHidden = $('#account-number-hidden');
    accountNumberVisible.toggle();
    accountNumberHidden.toggle();

    if (accountNumberVisible.is(':visible')) {
        $(this).removeClass('fa-eye-slash').addClass('fa-eye');  
    } else {
        $(this).removeClass('fa-eye').addClass('fa-eye-slash');  
    };
});

$(document).on("click", "#initiate_withdraw_request", function () {
    const withdrawRequestId = $(this).data('id');

    $("#withdrawRequestFinalAcceptModal #withdraw_request_id").val(withdrawRequestId);
    $("#withdrawRequestFinalAcceptModal").modal("show");
});

$(document).on("click", ".accept_withdraw_request", function () {
    const withdrawRequestId = $("#withdrawRequestFinalAcceptModal #withdraw_request_id").val();

    const data = {
        withdrawRequestId: withdrawRequestId,
    };

    postAjaxCall("/admin/update-withdraw-request-status", data, function (res) {
        showToast(res.flag, res.msg);

        if (res.flag === 1) {
            setTimeout(() => {
                $("#withdrawRequestFinalAcceptModal").modal("hide");
                $("#withdraw-request-accept").modal('show');
            }, 500);
        };
    });
});

$(document).on("click", ".change_withdraw_status", function () {
    let status_val = $(this).data("status");
    let status_text_val = $(this).data("status-text");

    $(".change_withdraw_status").removeClass("active");
    $("#clear_status_filter").removeClass("btn-disabled");
    $("#withdraw_status_btn .hr-line-sm").addClass("active");
    $("#withdraw_status_btn .filter-data").text(status_text_val).addClass("active");
    $(this).addClass("active");

    let status_filter = {
        status: parseInt(status_val),
    };

    withdrawRequestByOpertorFilter(status_filter);
});

$(".cancel-btn").on("click", function () {
    location.reload(1)
})

$(document).on("click", "#clear_status_filter", function () {
    $(this).addClass("btn-disabled");
    $(".change_withdraw_status").removeClass("active");
    $("#withdraw_status_btn .hr-line-sm").removeClass("active");
    $("#withdraw_status_btn .filter-data").text("").removeClass("active");

    let status_filter = {
        status: "",
    };

    withdrawRequestByOpertorFilter(status_filter);
});

$(document).on("click", ".change_operator_activity_status", function () {
    let status_val = $(this).data("status");
    let status_text_val = $(this).data("status-text");

    $(".change_operator_activity_status").removeClass("active");
    $("#clear_operator_activity_status_filter").removeClass("btn-disabled");
    $("#operator_activity_status_btn .hr-line-sm").addClass("active");
    $("#operator_activity_status_btn .filter-data").text(status_text_val).addClass("active");
    $(this).addClass("active");

    let status_filter = {
        status: parseInt(status_val),
    };

    operatorActivityFilter(status_filter);
});

$(document).on("click", "#clear_operator_activity_status_filter", function () {
    $(this).addClass("btn-disabled");
    $(".change_operator_activity_status").removeClass("active");
    $("#operator_activity_status_btn .hr-line-sm").removeClass("active");
    $("#operator_activity_status_btn .filter-data").text("").removeClass("active");

    let status_filter = {
        status: "",
    };

    operatorActivityFilter(status_filter);
});

$(document).on("click", ".change_operator_activity_view_status", function () {
    let view_status_val = $(this).data("view-status");
    let view_status_text_val = $(this).data("view-status-text");

    $(".change_operator_activity_view_status").removeClass("active");
    $("#clear_operator_activity_view_status_filter").removeClass("btn-disabled");
    $("#operator_activity_view_status_btn .hr-line-sm").addClass("active");
    $("#operator_activity_view_status_btn .filter-data").text(view_status_text_val).addClass("active");
    $(this).addClass("active");

    let status_filter = {
        view_status: parseInt(view_status_val),
    };

    operatorActivityFilter(status_filter);
});

$(document).on("click", "#clear_operator_activity_view_status_filter", function () {
    $(this).addClass("btn-disabled");
    $(".change_operator_activity_view_status").removeClass("active");
    $("#operator_activity_view_status_btn .hr-line-sm").removeClass("active");
    $("#operator_activity_view_status_btn .filter-data").text("").removeClass("active");

    let status_filter = {
        view_status: "",
    };

    operatorActivityFilter(status_filter);
});

$(document).on("click", ".change_operator_booking_status", function () {
    let status_val = $(this).data("status");
    let status_text_val = $(this).data("status-text");
    $(".change_operator_booking_status").removeClass("active");
    $("#clear_operator_booking_status_filter").removeClass("btn-disabled");
    $("#operator_booking_status_btn .hr-line-sm").addClass("active");
    $("#operator_booking_status_btn .filter-data").text(status_text_val).addClass("active");
    $(this).addClass("active");

    let status_filter = {
        status: parseInt(status_val),
    };
    operatorBookingHistoryFilter(status_filter);
});

$(document).on("click", "#clear_operator_booking_status_filter", function () {
    $(this).addClass("btn-disabled");
    $(".change_operator_booking_status").removeClass("active");
    $("#operator_booking_status_btn .hr-line-sm").removeClass("active");
    $("#operator_booking_status_btn .filter-data").text("").removeClass("active");

    let status_filter = {
        status: "",
    };

    operatorBookingHistoryFilter(status_filter);
});

$(document).on("click", ".change_refund_status", function () {
    let status_val = $(this).data("status");
    let status_text_val = $(this).data("status-text");
    $(".change_refund_status").removeClass("active");
    $("#clear_refund_status_filter").removeClass("btn-disabled");
    $("#operator_refund_status_btn .hr-line-sm").addClass("active");
    $("#operator_refund_status_btn .filter-data").text(status_text_val).addClass("active");
    $(this).addClass("active");

    let status_filter = {
        status: parseInt(status_val),
    };
    operatoUserRefundRequestFilter(status_filter);
});

$(document).on("click", "#clear_refund_status_filter", function () {
    $(this).addClass("btn-disabled");
    $(".change_refund_status").removeClass("active");
    $("#operator_refund_status_btn .hr-line-sm").removeClass("active");
    $("#operator_refund_status_btn .filter-data").text("").removeClass("active");

    let status_filter = {
        status: "",
    };

    operatoUserRefundRequestFilter(status_filter);
});

$(document).on("click", ".update_activity_status", function () {
    const travelActivityId = $("#travelActivityId").val();
    const status = $(this).data("status");
    
    const payload = {
        travelActivityId: travelActivityId,
        status: status,
    };

    postAjaxCall("/admin/update-activity-status", payload, function (res) {
        showToast(res.flag, res.msg);
        if (res.flag === 1) {
            setTimeout(() => {
                location.reload(1);
            }, 1500);
        };
    });
});

$(document).on("click", "#edit-icon", function() {
    const inputField = $("#commission_rate");
    inputField.prop('disabled', false);  
    inputField.focus(); 
    $('#commission_rate').removeClass('d-none');
    $('#commission_value').addClass('d-none');
});

$(document).on("change", "#commission_rate", function() {
    const commissionRate = $("#commission_rate").val();
    let userId = $("#userId").val();

    if (commissionRate === "") {
        showToast(0, "Commission rate is required");
        return; 
    }

    const data = {
        commissionRate,
        userId
    };
    postAjaxCall("/admin/update-commission-rate", data, function(res) {
        showToast(res.flag, res.msg);

        if (res.flag === 1) {
            setTimeout(() => {
                location.reload(1);
            }, 500);
        }
    });
    $("#commission_rate").prop('disabled', true);
});

$(document).on("change", ".commission_status_update", function() {
    const status = $(this).val();
    const activityId = $(this).data("activity-id")
    const data = {
        status,
        activityId,
    };
    postAjaxCall("/admin/update-commission-status", data, function(res) {
        showToast(res.flag, res.msg);
        if (res.flag === 1) {
            setTimeout(() => {
                operatorBookingHistoryFilter({});
            }, 1500);
        };
    });
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

    operatorBookingHistoryFilter(objectData);
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

    operatorBookingHistoryFilter(objectData);
    toggleResetButtonVisibility();
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

    operatorBookingHistoryFilter(objectData);
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

    operatorBookingHistoryFilter(objectData);
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

    operatorBookingHistoryFilter(objectData);
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

    operatorBookingHistoryFilter(objectData);
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
    
    operatorBookingHistoryFilter(objectData);
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

    operatorBookingHistoryFilter(objectData);
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
    $(".change_payment_status").removeClass("active");
    $("#payment_status_btn .hr-line-sm").removeClass("active");
    $("#payment_status_btn .filter-data").text("").removeClass("active");
    $(".change_trip_status").removeClass("active");
    $("#trip_status_btn .hr-line-sm").removeClass("active");
    $("#trip_status_btn .filter-data").text("").removeClass("active");

    let objectData = {
        activityName: "",
        travelOperatorName: "",
        userName: "", 
        paymentStatus:"",
        tripStatus:""
    };

    operatorBookingHistoryFilter(objectData);
});

$(document).on("change", "#activity_view_status", function () {
    const travelActivityId = $("#travelActivityId").val();
    const viewStatus = $(this).val();
    
    const payload = {
        travelActivityId: travelActivityId,
        view_status: viewStatus,
    };

    postAjaxCall("/admin/update-activity-view-status", payload, function (res) {
        showToast(res.flag, res.msg);
        if (res.flag === 1) {
            setTimeout(() => {
                location.reload(1);
            }, 1000);
        };
    });
});

function toggleResetButtonVisibility() {
    const hasActiveFilters = $(".filter-btn .filter-data.active").text().trim() !== "";

    if (hasActiveFilters) {
        $(".f-reset-btn").removeClass("d-none");
    } else {
        $(".f-reset-btn").addClass("d-none");
    }
};

function operatorBookingHistoryFilter(data) {
    let operatorId = $("#userId").val();

    let objectData = {
        operatorId: operatorId,
    };

    let combinedObj = { ...objectData, ...data };

    setFilters(combinedObj);
    filterData("/admin/operator-booking-history-filter", "operator-booking-history-table-data");
};

function withdrawRequestByOpertorFilter(data) {
    let userId = $("#userId").val();

    let objectData = {
        userId: userId,
    };

    let combinedObj = { ...objectData, ...data };

    setFilters(combinedObj);
    filterData("/admin/withdraw-request-filter", "withdraw_request_table_data");
};

function operatorActivityFilter(data) {
    let userId = $("#userId").val();

    let objectData = {
        userId: userId,
    };

    let combinedObj = { ...objectData, ...data };

    setFilters(combinedObj);
    filterData("/admin/operator-activity-filter", "operator_activity_table_data");
};

function operatoUserRefundRequestFilter(data) {
    let userId = $("#userId").val();

    let objectData = {
        userId: userId,
    };

    let combinedObj = { ...objectData, ...data };

    setFilters(combinedObj);
    filterData("/admin/user-refund-request-filter", "user-refund-request-table-data");
};

function formatDate(date) {
    let d = new Date(date);
    let day = ("0" + d.getDate()).slice(-2);
    let month = ("0" + (d.getMonth() + 1)).slice(-2);
    let year = d.getFullYear();
    return `${day}-${month}-${year}`;
};
