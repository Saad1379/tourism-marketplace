$(document).ready(function() {
    $("#p_loader").addClass("d-none");
    mobileNumberSet();
});

$(document).on("input", ".user_phone_no", function(e) {
    let phoneNumber = $(this).val().replace(/\D/g, ''); 
    let input = $("#mobile_code");
    let selectedCountryData = input.intlTelInput("getSelectedCountryData");
    let expectedLength = getExpectedPhoneLength(selectedCountryData.iso2); 
    if (phoneNumber?.length > expectedLength) {
        phoneNumber = phoneNumber.substring(0, expectedLength);
    }
    if (phoneNumber?.length <= 3) {
        phoneNumber = phoneNumber.replace(/(\d{0,3})/, '($1');
    } else if (phoneNumber?.length <= 6) {
        phoneNumber = phoneNumber.replace(/(\d{3})(\d{0,3})/, '($1) $2');
    } else {
        phoneNumber = phoneNumber.replace(/(\d{3})(\d{3})(\d{0,4})/, '($1) $2-$3');
    };

    $(this).val(phoneNumber);
});

$(document).on("click", "#edit_profile_imaage", function(e) {
    e.preventDefault();
    $("#profileImageInputFile").click();
});

$(document).on("change", "#profileImageInputFile", function(e) {
    const file = e.target.files[0];
    if(file){
        const allowedExtensions = /(\.jpg|\.jpeg|\.png)$/i;
        if (!allowedExtensions.exec(file.name)) {
            return showOwnToast(0, "Only jpg, jpeg, png files are allowed.");
        };

        if(file.size > 1024 * 1024 * 4) {
            return showOwnToast(0, "Please upload thumbnail size up to 4MB.");
        };

        let reader = new FileReader();
        reader.onload = function (event) {
            $(".profile_img").attr("src", event.target.result);
        };
        reader.readAsDataURL(file);
    };
});

$(document).on("click", "#update_profile", function(e) {
    $("#p_loader").removeClass("d-none");
    e.preventDefault();
    if(!validateEditProfileForm()) {
        $("#p_loader").addClass("d-none");
        return;
    };

    let thisForm = $("#edit_profile_form")[0];
    let formData = new FormData(thisForm);
    let country_number_code = $(".iti__selected-dial-code").html();
    formData.append('countryNumberCode', country_number_code ? country_number_code : "+1");

    postFileCall("/edit-profile", formData, function(response) {
        $("#p_loader").addClass("d-none");
        if(response.flag === 1) {
            showToast(response.flag, response.msg);
            setTimeout(() => {
                location.reload();
            }, 500);
        } else {
            showToast(response.flag, response.msg);
        };
    });
});

function validateEditProfileForm() {
    let userName = $("#user_full_Name").val();
    let phoneNo = $("#mobile_code").val();
    let phoneNoPattern = /^\d+$/;
    let sanitizedPhoneNo = phoneNo.replace(/\D/g, '');
    let input = $("#mobile_code");
    let selectedCountryData = input.intlTelInput("getSelectedCountryData");
    let expectedLength = getExpectedPhoneLength(selectedCountryData.iso2);

    if(!userName) {
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

    if (expectedLength && sanitizedPhoneNo.length !== expectedLength) {
        showToast(0, `Phone number must be exactly ${expectedLength} digits for ${selectedCountryData.name} (+${selectedCountryData.dialCode})`);
        return false;
    }

    return true;
}

function mobileNumberSet() {
    const $input = $("#mobile_code");
    $input.intlTelInput({
        initialCountry: "auto",
        utilsScript: "https://cdnjs.cloudflare.com/ajax/libs/intl-tel-input/17.0.13/js/utils.js",
        geoIpLookup: function (callback) {
            $.get("https://ipinfo.io", function () {}, "jsonp").always(function (resp) {
                const countryCode = (resp && resp.country) ? resp.country : "us";
                callback(countryCode);
            });
        }
    });
    let country_number_code = $("#country_number_code").val();
    let phone_number = $input.val();
    
    let number = country_number_code + phone_number;

    $input.intlTelInput("setNumber", mobileNumberFormat(number));
};
