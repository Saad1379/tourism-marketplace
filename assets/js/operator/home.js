$(document).ready(function () {
    $("#p_loader").addClass("d-none");
});

$(".open_operator_new_modal_btn").on("click", function (event) {
    let modelType = $(this).data("model-type");
    $("#signInModel").modal("hide");
    $("#signUpModel").modal("hide");
    $("#forgotPasswordModel").modal("hide");
    if(parseInt(modelType) === 1){
        $("#signUpModel").modal("show");
        $("#register_user_name").val("");
        $("#register_email").val("");
        $("#register_password").val("");
        $("#register_password").attr("type", "password");
        $("#register_password_hide_show").removeClass("fa-eye").addClass("fa-eye-slash");
        $("#register_email_send_success_text").addClass("d-none");
    } else if(parseInt(modelType) === 2){
        $("#signInModel").modal("show");
        $("#login_email").val("");
        $("#login_password").val("");
        $("#login_password").attr("type", "password");
        $("#login_password_hide_show").removeClass("fa-eye").addClass("fa-eye-slash");
        $("#login_btn").addClass("btn-disabled");
        // $("#login_email_send_success_text").addClass("d-none");
    } else if(parseInt(modelType) === 3){
        $("#forgotPasswordModel").modal("show");
        $("#forgot_email").val("");
        $("#forgot_email_send_success_text").addClass("d-none");
    };
});

$(document).on("click", "#register_password_hide_show", function (event) {
    let passwordField = $("#register_password");
    if (passwordField.attr("type") === "password") {
        passwordField.attr("type", "text");
        $(this).removeClass("fa-eye-slash").addClass("fa-eye");
    } else {
        passwordField.attr("type", "password");
        $(this).removeClass("fa-eye").addClass("fa-eye-slash");
    };
});

$(document).on("click", ".register_modal_btn", function (e) {
    $("#signUpModel input").data("enterPressed", false);
    $("#register_email_send_success_text").addClass("d-none");
    $("#register_user_name").val("");
    $("#register_email").val("");
    $("#register_password").val("");
});

$(document).on("keydown", "#signUpModel input", function (event) {
    if (event.key === "Enter" || event.which === 13) {
        event.preventDefault();
        if (!$(this).data("enterPressed")) {
            $(this).data("enterPressed", true);
            $("#register_btn").trigger("click");
        };
    };
});

$(document).on("click", "#register_btn", function (e) {
    e.preventDefault();
    $("#p_loader").removeClass("d-none");

    const username = $("#register_user_name").val().trim();
    const email = $("#register_email").val().trim();
    const password = $("#register_password").val();
    const registerRef = $("#register_ref").val();

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+.[a-zA-Z]{2,}$/;

    let validationMessage = "";
    if (username?.length === 0) {
        validationMessage = "Username is required. Please enter your username.";
    } else if (username.length > 0 && username.length < 3) {
        validationMessage = "Please enter user name must be atleast 3 characters.";
    } else if (email?.length === 0) {
        validationMessage = "Email is required. Please enter your email address.";
    } else if (!emailRegex.test(email)) {
        validationMessage = "Please enter a valid email address.";
    } else if (!emailRegex.test(email)) {
        validationMessage = "Invalid email address. Please enter a valid email address.";
    } else if (email?.length > 255) {
        validationMessage = 'Email address is too long. Please enter a shorter email address.';
    } else if (password.length === 0) {
        validationMessage = "Password is required. Please enter your password.";
    } else if (password.length > 0 && password.length < 6) {
        validationMessage = "Please provide a valid password with a minimum length of 6 characters.";
    };

    if (validationMessage !== "") {
        $("#p_loader").addClass("d-none");
        showOwnToast(0, validationMessage);
        return;
    };

    const requestData = {
        username: username,
        email: email,
        password: password,
        registerRef: registerRef ? registerRef : "",
    };
    $(this).addClass("btn-disabled");

    postAjaxCall("/register", requestData, function (response) {
        setTimeout(() => {
            $("#p_loader").addClass("d-none");
        }, 800);
        if (response.flag === 1) {
            setTimeout(() => {
                $("#register_email_send_success_text").removeClass("d-none");
            }, 1000);
            setTimeout(() => {
                $("#signUpModel").modal("hide");
                location.reload(1);
            }, 2000);
        } else {
            setTimeout(() => {
                showOwnToast(response.flag, response.msg);
                $("#register_btn").removeClass("btn-disabled");
                $("#p_loader").addClass("d-none");
                $("#signUpModel input").data("enterPressed", false);
            }, 1500);
        };
    });
});

// Login JQuery

$(document).on("click", "#login_password_hide_show", function (event) {
    let passwordField = $("#login_password");
    if (passwordField.attr("type") === "password") {
        passwordField.attr("type", "text");
        $(this).removeClass("fa-eye-slash").addClass("fa-eye");
    } else {
        passwordField.attr("type", "password");
        $(this).removeClass("fa-eye").addClass("fa-eye-slash");
    };
});

$(document).on("keyup", "#signInModel input", function () {
    const email = $("#login_email").val();
    const password = $("#login_password").val();

    if(email && password){
        $("#login_btn").removeClass("btn-disabled");
    } else {
        $("#login_btn").addClass("btn-disabled");
    };
});

$(document).on("click", ".login_modal_btn", function (e) {
    $("#signInModel input").data("enterPressed", false);
    // $("#login_email_send_success_text").addClass("d-none");
    $("#login_email").val("");
    $("#login_password").val("");
    $("#login_btn").addClass("btn-disabled");
});

$(document).on("keydown", "#signInModel input", function (event) {
    if (event.key === "Enter" || event.which === 13) {
        event.preventDefault();
        if (!$(this).data("enterPressed")) {
            $(this).data("enterPressed", true);
            $("#login_btn").trigger("click");
        };
    };
});

$(document).on("click", "#login_btn", function (e) {
    e.preventDefault();

    const email = $("#login_email").val().trim();
    const password = $("#login_password").val();

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+.[a-zA-Z]{2,}$/;

    let validationMessage = "";   
    if (email?.length === 0) {
        validationMessage = "Email is required. Please enter your email address.";
    } else if (!emailRegex.test(email)) {
        validationMessage = "Please enter a valid email address.";
    } else if (!emailRegex.test(email)) {
        validationMessage = "Invalid email address. Please enter a valid email address.";
    } else if (email.length > 255) {
        validationMessage = 'Email address is too long. Please enter a shorter email address.';
    } else if (password.length === 0) {
        validationMessage = "Password is required. Please enter your password.";
    } else if (password.length > 0 && password.length < 6) {
        validationMessage = "Please provide a valid password with a minimum length of 6 characters.";
    };

    if (validationMessage !== "") {
        showOwnToast(0, validationMessage);
        return;
    };

    const requestData = {
        email: email,
        password: password,
    };

    $("#p_loader").removeClass("d-none");
    $(this).addClass("btn-disabled");

    postAjaxCall("/login", requestData, function (response) {
        $("#p_loader").addClass("d-none");
        showOwnToast(response.flag, response.msg);
        if (response.flag === 1) {
            setTimeout(() => {
                $("#signInModel").modal("hide");
                window.location.href = '/dashboard';
            }, 1000);
        } else {
            $("#login_btn").removeClass("btn-disabled");
            $("#signInModel input").data("enterPressed", false);
        };
    });
});

// Forgot Password

$(document).on("keydown", "#forgotPasswordModel input", function (event) {
    if (event.key === "Enter" || event.which === 13) {
        event.preventDefault();
        if (!$(this).data("enterPressed")) {
            $(this).data("enterPressed", true);
            $("#forgot_pass_btn").trigger("click");
        };
    };
});

$(document).on("click", "#forgot_pass_btn", function (e) {
    e.preventDefault();
    $("#p_loader").removeClass("d-none");

    const email = $("#forgot_email").val().trim();

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+.[a-zA-Z]{2,}$/;

    let validationMessage = "";
    if (email?.length === 0) {
        validationMessage = "Email is required. Please enter your email address.";
    } else if (!emailRegex.test(email)) {
        validationMessage = "Please enter a valid email address.";
    } else if (!emailRegex.test(email)) {
        validationMessage = "Invalid email address. Please enter a valid email address.";
    } else if (email?.length > 255) {
        validationMessage = 'Email address is too long. Please enter a shorter email address.';
    };

    if (validationMessage !== "") {
        $("#p_loader").addClass("d-none");
        showOwnToast(0, validationMessage);
        return;
    };

    const requestData = {
        email: email,
    };
    $(this).addClass("btn-disabled");

    postAjaxCall("/forgot-password-mail", requestData, function (response) {
        $("#p_loader").addClass("d-none");
        if (response.flag === 1) {
            setTimeout(() => {
                $("#forgot_email_send_success_text").removeClass("d-none");
            }, 1000);
            setTimeout(() => {
                $("#forgotPasswordModel").modal("hide");
                location.reload(1);
            }, 2000);
        } else {
            setTimeout(() => {
                showOwnToast(response.flag, response.msg);
                $("#forgot_pass_btn").removeClass("btn-disabled");
                $("#p_loader").addClass("d-none");
                $("#forgotPasswordModel input").data("enterPressed", false);
            }, 1500);
        };
    });
});
