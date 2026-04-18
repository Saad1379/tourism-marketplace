$(document).ready(function() {
    $("#p_loader").addClass("d-none");
    mobileNumberSet();
    officeNumberSet();
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
    }

    $(this).val(phoneNumber); 
});

$(document).on("countrychange", "#mobile_code", function(e) {
    const countryData = $(this).intlTelInput("getSelectedCountryData");
    $("#country_iso_code").val(countryData.iso2);
});

$(document).on("countrychange", "#office_mobile_code", function(e) {
    const countryOfficeData = $(this).intlTelInput("getSelectedCountryData");
    $("#office_country_iso_code").val(countryOfficeData.iso2);
});

$(document).on("input", ".user_office_no", function(e) {
    let officePhoneNumber = $(this).val().replace(/\D/g, ''); 
    let input = $("#office_mobile_code");
    let selectedCountryData = input.intlTelInput("getSelectedCountryData");
    let expectedLength = getExpectedPhoneLength(selectedCountryData.iso2); 

    if (officePhoneNumber?.length > expectedLength) {
        officePhoneNumber = officePhoneNumber.substring(0, expectedLength);
    }

    if (officePhoneNumber?.length <= 3) {
        officePhoneNumber = officePhoneNumber.replace(/(\d{0,3})/, '($1');
    } else if (officePhoneNumber?.length <= 6) {
        officePhoneNumber = officePhoneNumber.replace(/(\d{3})(\d{0,3})/, '($1) $2');
    } else {
        officePhoneNumber = officePhoneNumber.replace(/(\d{3})(\d{3})(\d{0,4})/, '($1) $2-$3');
    }

    $(this).val(officePhoneNumber);
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

$('#user_full_Name').on('input', function () {
    let sanitized = $(this).val().replace(/[^a-zA-Z\s]/g, '');
    $(this).val(sanitized);
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

    let office_number_code = $("#office_mobile_code").intlTelInput("getSelectedCountryData").dialCode;
    formData.append('officeNumberCode', office_number_code ? office_number_code : "+1");

    let selectedCountryISO = $("#country_iso_code").val();
    formData.append('countryIsoCode', selectedCountryISO);

    let selectedOfficeCountryISO = $("#office_country_iso_code").val();
    formData.append('officeCountryIsoCode', selectedOfficeCountryISO);

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

$(document).on("input", ".user_bussiness_no", function () {
    let value = $(this).val().replace(/\D/g, ""); 
    value = value.slice(0, 10);
    $(this).val(value);
});

$.get("https://countriesnow.space/api/v0.1/countries", function (data) {
    const countries = data.data;
    $.each(countries, function (i, country) {
        $('#operator_country').append(`<option value="${country.country}">${country.country}</option>`);
    });
});

$('#operator_country').on('change', function () {
    let selectedCountry = $(this).val();
    $('#operator_state').prop('disabled', true);
    $('#operator_city').prop('disabled', true);
    $('#operator_state').html('<option value="">Loading...</option>');
    $('#operator_city').html('<option value="">Select City</option>');

    $.ajax({
        url: "https://countriesnow.space/api/v0.1/countries/states",
        method: "POST",
        data: JSON.stringify({ country: selectedCountry }),
        contentType: "application/json",
        success: function (response) {
            $('#operator_state').html('<option value="">Select State</option>');
            $.each(response.data.states, function (i, state) {
                $('#operator_state').append(`<option value="${state.name}">${state.name}</option>`);
            });
            $('#operator_state').prop('disabled', false);
        },
        error: function () {
            $('#operator_state').html('<option value="">Failed to load states</option>');
            $('#operator_state').prop('disabled', false);
        }
    });
});

$('#operator_state').on('change', function () {
    let selectedCountry = $('#operator_country').val();
    let selectedState = $(this).val();

    $('#operator_city').prop('disabled', true);
    $('#operator_city').html('<option value="">Loading...</option>');

    $.ajax({
        url: "https://countriesnow.space/api/v0.1/countries/state/cities",
        method: "POST",
        data: JSON.stringify({ country: selectedCountry, state: selectedState }),
        contentType: "application/json",
        success: function (response) {
            $('#operator_city').html('<option value="">Select City</option>');

            $.each(response.data, function (i, city) {
                $('#operator_city').append(`<option value="${city}">${city}</option>`);
            });

            $('#operator_city').prop('disabled', false);
        },
        error: function () {
            $('#operator_city').html('<option value="">Failed to load cities</option>');
            $('#operator_city').prop('disabled', false);
        }
    });
});

function validateEditProfileForm() {
    let userName = $("#user_full_Name").val();
    let phoneNo = $("#mobile_code").val();
    let officeMobileCode = $("#office_mobile_code").val();
    let phoneNoPattern = /^\d+$/;
    let sanitizedPhoneNo = phoneNo.replace(/\D/g, '');
    let sanitizedOfficeNo = officeMobileCode.replace(/\D/g, '');
    const country  = $("#operator_country").val();
    const city = $("#operator_city").val();
    const state = $("#operator_state").val();
    let input = $("#mobile_code");
    let selectedCountryData = input.intlTelInput("getSelectedCountryData");
    let expectedLength = getExpectedPhoneLength(selectedCountryData.iso2);
    let officeInput = $("#office_mobile_code");
    let officeSelectedCountryData = officeInput.intlTelInput("getSelectedCountryData");
    let expectedOfficeLength = getExpectedPhoneLength(officeSelectedCountryData.iso2);

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

    if(!sanitizedOfficeNo) {
        showToast(0, "Please enter Office number.");
        return false;
    };

    if(!phoneNoPattern.test(sanitizedOfficeNo)) {
        showToast(0, "Office number must be numeric.");
        return false;
    };

    if (expectedOfficeLength && sanitizedOfficeNo.length !== expectedOfficeLength) {
        showToast(0, `Office number must be exactly ${expectedOfficeLength} digits for ${officeSelectedCountryData.name} (+${officeSelectedCountryData.dialCode})`);
        return false;
    }

    if(!country) {
        showToast(0, "Please enter country name");
        return false;
    };
    if(!state) {
        showToast(0, "Please enter state name");
        return false;
    };

    return true;
}

function mobileNumberSet() {
    const $input = $("#mobile_code");

    $input.intlTelInput("destroy");

    let selectedCountryISO = $("#country_iso_code").val();

    $input.intlTelInput({
        initialCountry: selectedCountryISO || "auto",
        utilsScript: "https://cdnjs.cloudflare.com/ajax/libs/intl-tel-input/17.0.13/js/utils.js",
        geoIpLookup: function (callback) {
            if (!selectedCountryISO) {
                $.get("https://ipinfo.io", function () {}, "jsonp").always(function (resp) {
                    const countryCode = (resp && resp.country) ? resp.country.toLowerCase() : "us";
                    callback(countryCode);
                });
            };
        }
    });

    if (selectedCountryISO) {
        $input.intlTelInput("setCountry", selectedCountryISO);
    };

    let country_number_code = $("#country_number_code").val();
    let phone_number = $input.val();    
    let number = country_number_code + phone_number;

    $input.intlTelInput("setNumber", mobileNumberFormat(number));
};

function officeNumberSet() {
   const $Officeinput = $("#office_mobile_code");

    $Officeinput.intlTelInput("destroy");

    let selectedOfficeCountryISO = $("#office_country_iso_code").val();

    $Officeinput.intlTelInput({
        initialCountry: selectedOfficeCountryISO || "auto",
        utilsScript: "https://cdnjs.cloudflare.com/ajax/libs/intl-tel-input/17.0.13/js/utils.js",
        geoIpLookup: function (callback) {
            if (!selectedOfficeCountryISO) {
                $.get("https://ipinfo.io", function () {}, "jsonp").always(function (resp) {
                    const countryCode = (resp && resp.country) ? resp.country.toLowerCase() : "us";
                    callback(countryCode);
                });
            };
        }
    });

    if (selectedOfficeCountryISO) {
        $Officeinput.intlTelInput("setCountry", selectedOfficeCountryISO);
    };

    let office_number_code = $("#office_number_code").val();
    let phone_number = $Officeinput.val();    
    let number = office_number_code + phone_number;

    $Officeinput.intlTelInput("setNumber", mobileNumberFormat(number));
};
