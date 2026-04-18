jQuery(function() {
    $("#clear_status_filter").addClass("btn-disabled");
    $("#withdraw_status_btn .hr-line-sm").removeClass("active");
    $("#withdraw_status_btn .filter-data").text("").removeClass("active");
    $("#clear_affilliate_booking_status_filter").addClass("btn-disabled");
    $("#affilliate_booking_status_btn .hr-line-sm").removeClass("active");
    $("#affilliate_booking_status_btn .filter-data").text("").removeClass("active");
    clearBookingFilter({});
});

$(document).on("click", "#sb-listing-tab", function () {
    clearBookingFilter({});
});

$(document).on("click", "#sb-withdraw-tab", function () {
    clearWithdrawRequestFilter({});
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
        }
    });
});

$('#ey2').click(function() {
    var accountNumberVisible = $('#account-number-visible');
    var accountNumberHidden = $('#account-number-hidden');
    accountNumberVisible.toggle();
    accountNumberHidden.toggle();
    if (accountNumberVisible.is(':visible')) {
      $(this).removeClass('fa-eye-slash').addClass('fa-eye');  
    } else {
      $(this).removeClass('fa-eye').addClass('fa-eye-slash');  
    }
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

    withdrawRequestByAffiliateFilter(status_filter);
});

$(document).on("click", "#clear_status_filter", function () {
    clearWithdrawRequestFilter();
});

$(document).on("click", ".change_affilliate_booking_status", function () {
    let status_val = $(this).data("status");
    let status_text_val = $(this).data("status-text");
    $(".change_affilliate_booking_status").removeClass("active");
    $("#clear_affilliate_booking_status_filter").removeClass("btn-disabled");
    $("#affilliate_booking_status_btn .hr-line-sm").addClass("active");
    $("#affilliate_booking_status_btn .filter-data").text(status_text_val).addClass("active");
    $(this).addClass("active");

    let status_filter = {
        status: parseInt(status_val),
    };
      bookingByAffiliateFilter(status_filter);
});

$(document).on("click", "#clear_affilliate_booking_status_filter", function () {
    clearBookingFilter();
});

$(document).on("change", "#change_account_status", function () {
    const userId = $("#userId").val();
    const status = $(this).val();

    let infoText = "";
    let buttonText = "";
    let buttonClass = "";
    if (parseInt(status) === 3) {
        infoText = "Are you sure you wants to suspend this Affiliate?";
        buttonText = "Suspend";
        buttonClass = "btn-red";
    } else if (parseInt(status) === 2) {
        infoText = "Are you sure you wants to Active this Affiliate?";
        buttonText = "Active";
        buttonClass = "btn-green";
    } else if (parseInt(status) === 1) {
        infoText = "Are you sure you wants to InActive this Affiliate?";
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

function clearBookingFilter() {
    $(".change_affilliate_booking_status").removeClass("active");
    $("#clear_affilliate_booking_status_filter").addClass("btn-disabled");
    $("#affilliate_booking_status_btn .hr-line-sm").removeClass("active");
    $("#affilliate_booking_status_btn .filter-data").text("").removeClass("active");

    let status_filter = {
        status: "",
    };

    bookingByAffiliateFilter(status_filter);
};

function clearWithdrawRequestFilter() {
    $(".change_withdraw_status").removeClass("active");
    $("#clear_status_filter").addClass("btn-disabled");
    $("#withdraw_status_btn .hr-line-sm").removeClass("active");
    $("#withdraw_status_btn .filter-data").text("").removeClass("active");

    let status_filter = {
        status: "",
    };

    withdrawRequestByAffiliateFilter(status_filter);
};

function withdrawRequestByAffiliateFilter(data) {
    let userId = $("#userId").val();

    let objectData = {
        userId: userId,
    };

    let combinedObj = { ...objectData, ...data };

    setFilters(combinedObj);
    filterData("/admin/withdraw-request-filter", "withdraw_request_table_data");
};

function bookingByAffiliateFilter(data) {
    let userId = $("#userId").val();

    let objectData = {
        userId: userId,
    };

    let combinedObj = { ...objectData, ...data };

    setFilters(combinedObj);
    filterData("/admin/affiliate-member-booking-history-filter", "affiliate-member-booking-history_table_data");
};
