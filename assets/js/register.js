$(document).ready(function () {
    $("#p_loader").addClass("d-none");
});

$(".register_modal_btn").on("click", function (e) {
    $("#signUpModel input").data("enterPressed", false);
    $("#register_email_send_success_text").addClass("d-none");
    $("#register_email").val("");
});

$("#signUpModel input").on("keydown", function(event) {
    if (event.key === "Enter" || event.which === 13) {
        event.preventDefault();
        if (!$(this).data("enterPressed")) {
            $(this).data("enterPressed", true);
            $("#register_btn").trigger("click");
        };
    };
});

$('#register_btn').on('click', function (e) {
    e.preventDefault();
    $("#p_loader").removeClass("d-none");

    const email = $("#register_email").val().trim();
    const registerRef = $("#register_ref").val();

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
            }, 1500);
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
