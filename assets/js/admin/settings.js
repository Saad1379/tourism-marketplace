$(document).on("click", "#save-settings", function() {
    const adminUrlToken = $("#admin-url-token").val();
    const commissionRate = $('#commission-rate').val();

    if (adminUrlToken === ""){
        showToast(0,"Admin URL Token is required");
    } else if(commissionRate === " "){
        showToast(0,"Commission Rate is required")
    };

    const data = {
        adminUrlToken,
        commissionRate
    };
    postAjaxCall("/admin/save-settings", data, function(response) {
        if (response.flag === 1) {
            showToast(1,"Settings saved successfully", 1500);
        } else {
            showToast(0,response.msg)
        };
    });
});

$("#old_password, #new_password").on("input", function() {
    const old_password = $("#old_password").val();
    const new_password = $("#new_password").val();
    if (old_password && new_password) {
        $("#password_save").prop("disabled", false);
    } else {
        $("#password_save").prop("disabled", true);
    };
});

$("#password_save").on("click", () => {
    const old_password = $("#old_password").val();
    const new_password = $("#new_password").val();

    if(!old_password){
        showToast(0, "Please enter your old password");
        return false;
    };

    if(!new_password){
        showToast(0, "Please enter a new password");
        return false;
    };

    if(new_password === old_password){
        showToast(0, "Your new password must be different from your current password to ensure account security.");
        return false;
    };

    if (new_password !== "" && new_password?.length < 6) {
        showToast(0, "Your new password must be at least 6 characters long.");
        return false;
    };

    if(new_password !== "" && new_password.length > 20){
        showToast(0, "Password must be at most 20 characters long");
        return false;
    };

    let payload = {
        oldPassword: old_password,
        newPassword: new_password,
    };

    $("#password_save").prop("disabled", true);

    postAjaxCall("/admin/changePassword", payload, (response) => {
        showToast(response.flag, response.msg);
        if (response.flag === 1) {
            setTimeout(() => {
                location.reload();
            }, 1500);
        } else {
            setTimeout(() => {
                $("#password_save").prop("disabled", false);
            }, 1000);
        };
    });
});

$('#ey2').click(function() {
    let passwordField = $('#old_password');
    if (passwordField.attr('type') === 'password') {
        passwordField.attr('type', 'text');  
        $(this).removeClass('fa-eye-slash').addClass('fa-eye');  
    } else {
        passwordField.attr('type', 'password');  
        $(this).removeClass('fa-eye').addClass('fa-eye-slash');  
    };
});

$('#ey3').click(function() {
    let passwordField = $('#new_password');
    if (passwordField.attr('type') === 'password') {
        passwordField.attr('type', 'text');  
        $(this).removeClass('fa-eye-slash').addClass('fa-eye');  
    } else {
        passwordField.attr('type', 'password');  
        $(this).removeClass('fa-eye').addClass('fa-eye-slash');  
    };
});
