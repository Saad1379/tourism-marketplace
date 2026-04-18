$(document).ready(function () {
    $("#p_loader").addClass("d-none");
});

$(".login_modal_btn").on("click", function (e) {
    $("#signInModel input").data("enterPressed", false);
    $("#login_email_send_success_text").addClass("d-none");
    $("#login_email").val("");
});

$("#signInModel input").on("keydown", function(event) {
    if (event.key === "Enter" || event.which === 13) {
        event.preventDefault();
        if (!$(this).data("enterPressed")) {
            $(this).data("enterPressed", true);
            $("#login_btn").trigger("click");
        };
    };
});

$("#login_btn").on("click", function (e) {
    e.preventDefault();
    $("#p_loader").removeClass("d-none");

    const email = $("#login_email").val().trim();

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
    };

    if (validationMessage !== "") {
        $("#p_loader").addClass("d-none");
        showOwnToast(0, validationMessage);
        return;
    };

    const requestData = { email: email };
    $(this).addClass("btn-disabled");

    postAjaxCall("/login", requestData, function (response) {
        setTimeout(() => {
            $("#p_loader").addClass("d-none");
        }, 800);
        if (response.flag === 1) {
            setTimeout(() => {
                $("#login_email_send_success_text").removeClass("d-none");
            }, 1000);
            setTimeout(() => {
                $("#signInModel").modal("hide");
                location.reload(1);
            }, 1500);
        } else {
            setTimeout(() => {
                showOwnToast(response.flag, response.msg);
                $("#login_btn").removeClass("btn-disabled");
                $("#p_loader").addClass("d-none");
                $("#signInModel input").data("enterPressed", false);
            }, 1500);
        };
    });
});
