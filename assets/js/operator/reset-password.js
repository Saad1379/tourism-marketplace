$(document).ready(function () {
    $("#p_loader").addClass("d-none");
    $("#new_reset_password").val("");
    $("#confirm_reset_password").val("");
});

$(document).on("click", "#reset_new_password_hide_show", function (event) {
    let passwordField = $("#new_reset_password");
    if (passwordField.attr("type") === "password") {
        passwordField.attr("type", "text");
        $(this).removeClass("fa-eye-slash").addClass("fa-eye");
    } else {
        passwordField.attr("type", "password");
        $(this).removeClass("fa-eye").addClass("fa-eye-slash");
    };
});

$(document).on("click", "#reset_confirm_password_hide_show", function (event) {
    let passwordField = $("#confirm_reset_password");
    if (passwordField.attr("type") === "password") {
        passwordField.attr("type", "text");
        $(this).removeClass("fa-eye-slash").addClass("fa-eye");
    } else {
        passwordField.attr("type", "password");
        $(this).removeClass("fa-eye").addClass("fa-eye-slash");
    };
});

$(document).on("click", "#reset_password_btn", function (e) {
    e.preventDefault();
    $("#p_loader").removeClass("d-none");

    const operator_email = $("#reset_password_email_id").val();
    const new_reset_password = $("#new_reset_password").val();
    const confirm_reset_password = $("#confirm_reset_password").val();

    let validationMessage = "";
    if (new_reset_password?.length === 0) {
        validationMessage = "New password is required. Please enter your new password.";
    } else if (new_reset_password.length > 0 && new_reset_password.length < 6) {
        validationMessage = "Please provide a valid new password with a minimum length of 6 characters.";
    } else if (confirm_reset_password?.length === 0) {
        validationMessage = "Please enter confirm password.";
    } else if (confirm_reset_password !== new_reset_password) {
        validationMessage = "The new password and confirmation password do not match. Please ensure both fields are identical and try again.";
    };

    if (validationMessage !== "") {
        $("#p_loader").addClass("d-none");
        showOwnToast(0, validationMessage);
        return;
    };

    const requestData = {
        email: operator_email,
        password: new_reset_password,
    };
    $(this).addClass("btn-disabled");

    postAjaxCall("/reset-password", requestData, function (response) {
        $("#p_loader").addClass("d-none");
        showOwnToast(response.flag, response.msg);
        if (response.flag === 1) {
            setTimeout(() => {
                window.location.href = "/";
            }, 2000);
        } else {
            $("#reset_password_btn").removeClass("btn-disabled");
        };
    });
});
