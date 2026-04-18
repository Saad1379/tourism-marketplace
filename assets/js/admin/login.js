$(document).ready(function () {
    $("#email").val("");
    $("#password").val("");
});

$(document).on("keyup", "#form-login input", function () {
    const email = $("#email").val();
    const password = $("#password").val();
    $("#btnLogin").prop("disabled", !(email && password));
});

$(document).on("keypress", "#form-login input", function (event) {
    if (event.which === 13) {  
        $("#btnLogin").trigger("click");
    }
});

$(document).on("click", "#ey2", function (event) {
    let passwordField = $("#password");
    if (passwordField.attr("type") === "password") {
        passwordField.attr("type", "text");
        $(this).removeClass("fa-eye-slash").addClass("fa-eye");
    } else {
        passwordField.attr("type", "password");
        $(this).removeClass("fa-eye").addClass("fa-eye-slash");
    };
});

$(document).on("click", "#btnLogin", function (event) {
    $("#btnLogin").prop("disabled", true); 
    $(".t-loader").removeClass("d-none"); 
    $("#login-btn-text").addClass("d-none"); 

    const email = $("#email").val();
    const password = $("#password").val();

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+.[a-zA-Z]{2,}$/;

    let validationMessage = "";
    if (email.length === 0) {
        validationMessage = "Email is required. Please enter your email address.";
    } else if (password.length === 0) {
        validationMessage = "Password must be at least 6 characters long. Please enter a valid password.";
    } else if (!emailRegex.test(email) && password.length < 6) {
        validationMessage = "Please enter a valid email address and ensure your password is at least 6 characters long.";
    } else if (!emailRegex.test(email)) {
        validationMessage = "Invalid email address. Please enter a valid email address.";
    } else if (email.length > 255) {      
        validationMessage = 'Email address is too long. Please enter a shorter email address.';
    } else if (password.length > 0 && password.length < 6) {
        validationMessage = "Please provide a valid password with a minimum length of 6 characters.";
    };

    if (validationMessage) {
        showToast(0, validationMessage);
        setTimeout(() => {
            $("#btnLogin").prop("disabled", false); 
            $(".t-loader").addClass("d-none");
            $("#login-btn-text").removeClass("d-none");
        }, 1000); 
        return;
    };

    postAjaxCall("/admin/login", { email, password }, function(res) {
        showToast(res.flag, res.msg);
        if (res.flag === 1) {
            $("#btnLogin").prop("disabled", true);
            $(".t-loader").removeClass("d-none");
            setTimeout(function() {
                $(".t-loader").removeClass("d-none");
                window.location.href = '/admin/admin-dashboard';
            }, 500);
        };

        setTimeout(() => {
            $("#btnLogin").prop("disabled", false);
            $(".t-loader").addClass("d-none");
            $("#login-btn-text").removeClass("d-none");
        }, 1000); 
    });
});
