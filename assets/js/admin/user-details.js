jQuery(function() {
    userActivityFilter({});
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
    }
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
    }
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
    }
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

$(document).on("change", "#change_account_status", function () {
    const userId = $("#userId").val();
    const status = $(this).val();

    let infoText = "";
    let buttonText = "";
    let buttonClass = "";
    if (parseInt(status) === 3) {
        infoText = "Are you sure you want to suspend this User?";
        buttonText = "Suspend";
        buttonClass = "btn-red";
    } else if (parseInt(status) === 2) {
        infoText = "Are you sure you wants to Active this User?";
        buttonText = "Active";
        buttonClass = "btn-green";
    } else if (parseInt(status) === 1) {
        infoText = "Are you sure you wants to InActive this User?";
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

$(".cancel-btn").on("click", function () {
    location.reload(1)
})

function userActivityFilter(data) {
    let userId = $("#userId").val();

    let objectData = {
        userId: userId,
    };

    let combinedObj = { ...objectData, ...data };

    setFilters(combinedObj);
    filterData("/admin/user-activity-filter", "user_activity_table_data");
};
