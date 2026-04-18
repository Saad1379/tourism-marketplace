var flat_datepickr;
$(document).ready(function() {
    $("#p_loader").addClass("d-none");
    let select_meeting_point = localStorage.getItem("selectMeetingPoint");
    let select_meeting_latitude = localStorage.getItem("selectMeetingLatitude");
    let select_meeting_longitude = localStorage.getItem("selectMeetingLongitude");

    if(select_meeting_point === "undefined" || select_meeting_point === "null" || select_meeting_point === ""){
        $("#select_meeting_point_val").text("N/A");
        $("#select_meeting_point_name").val("N/A");
    } else {
        $("#select_meeting_point_val").text(select_meeting_point);
        $("#select_meeting_point_name").val(select_meeting_point);
    };

    if(select_meeting_latitude === "undefined" && select_meeting_latitude === "null" && select_meeting_latitude === ""){
        $("#meet_point_latitude").val("");
    } else {
        $("#meet_point_latitude").val(select_meeting_latitude);
    };

    if(select_meeting_longitude === "undefined" && select_meeting_longitude === "null" && select_meeting_longitude === ""){
        $("#meet_point_longitude").val("");
    } else {
        $("#meet_point_longitude").val(select_meeting_longitude);
    };

    if(select_meeting_latitude && select_meeting_longitude){
        $("#openMeetPointMap").removeClass("d-none");
    } else {
        $("#openMeetPointMap").addClass("d-none");
    };

    mobileNumberSet();

    let defaultDateFromUrl = getDateFromUrl();

    let activtityDayOperatingHours = [];
    if (typeof activtityOperatingHours !== 'undefined') {
        activtityDayOperatingHours = activtityOperatingHours;
    };

    const allowedDayIndices = activtityDayOperatingHours.map((item) =>
        ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].indexOf(item?.day)
    );

    flat_datepickr = flatpickr("#datepicker", {
        minDate: "today",
        defaultDate: defaultDateFromUrl,
        clickOpens: false,
        enable: [
            function(date) {
                return allowedDayIndices.includes(date.getDay());
            },
        ],
        onChange: function(selectedDates, dateStr, instance) {
            $("#datepicker").val("");
            let date = selectedDates[0];
            let formattedDate = shortDateFormat(date);
            $("#setCustomDate").html(formattedDate);

            let day = ('0' + date.getDate()).slice(-2);
            let month = ('0' + (date.getMonth() + 1)).slice(-2);
            let year = date.getFullYear();

            let urlDate = `${day}-${month}-${year}`;

            let currentBookingUrl = window.location.href;
            let newUrl = currentBookingUrl.replace(/\/\d{1,2}-\d{1,2}-\d{4}$/, `/${urlDate}`);
            window.location.href = newUrl;
        },
        onDayCreate: function(dObj, dStr, fp, dayElem) {
            let highlightDate = new Date(defaultDateFromUrl);
            let current = dayElem.dateObj;

            if (
                highlightDate.getDate() === current.getDate() &&
                highlightDate.getMonth() === current.getMonth() &&
                highlightDate.getFullYear() === current.getFullYear()
            ) {
                dayElem.classList.add("highlight-selected-date");
            };
        },
    });
    totalFinalAmountCount();
});

$("#openDatepicker").on("click", function (e) {
    $(".flatpickr-calendar").addClass("custom-flatpickr");
    flat_datepickr.open();
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

$(".time_slot").on("change", function (e) {
    let select_slot = $(this).val();

    let split_date = select_slot.split('-');

    let startDate = split_date[0];
    let endDate = split_date[1];

    let fullDateView = startDate + " to " + endDate;
    $("#select_time_slot_html").text(fullDateView);
});

// Meeting Point Open Google Map Redirect
$("#openMeetPointMap").on("click", function() {
    let latitude = $("#meet_point_latitude").val();
    let longitude = $("#meet_point_longitude").val();

    let mapUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
    window.open(mapUrl, '_blank');
});

// End Point Open Google Map Redirect
$("#openEndPointMap").on("click", function() {
    let latitude = $(this).data("latitude");
    let longitude = $(this).data("longitude");

    let mapUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
    window.open(mapUrl, '_blank');
});

$("#plus_adult_count").click(function() {
    let currentValue = parseFloat($("#input_adult_count").val());

    let newPlusVal = parseFloat(currentValue + 1);

    $("#input_adult_count").val(newPlusVal);

    let single_adult_amount = parseFloat($("#adult_amount_val").val());

    let total_adult_amount_val = (single_adult_amount * newPlusVal);

    $("#total_adult_count_val").html(newPlusVal + " Adults");
    $("#final_adult_amount_val").html("$" + total_adult_amount_val.toFixed(2));

    $("#total_adult_count_val").attr("data-total-adult", newPlusVal);
    $("#final_adult_val").val(total_adult_amount_val);

    totalFinalAmountCount();
    
    if (currentValue + 1 > 0) {
        $("#minus_adult_count").removeClass("btn-disabled");
    };
});

$("#minus_adult_count").click(function() {
    $("#plus_adult_count").removeClass("btn-disabled");
    let currentValue = parseFloat($("#input_adult_count").val());

    if (currentValue === 0) {
        return;
    };

    if (currentValue > 0) {
        let newMinusVal = parseFloat(currentValue - 1);

        $("#input_adult_count").val(newMinusVal);

        let single_adult_amount = parseFloat($("#adult_amount_val").val());

        let total_adult_amount_val = (single_adult_amount * newMinusVal);

        $("#total_adult_count_val").html(newMinusVal + " Adults");
        $("#final_adult_amount_val").html("$" + total_adult_amount_val.toFixed(2));

        $("#total_adult_count_val").attr("data-total-adult", newMinusVal);
        $("#final_adult_val").val(total_adult_amount_val);

        totalFinalAmountCount();
    };

    if (currentValue - 1 <= 0) {
        $(this).addClass("btn-disabled");
    };
});

$("#plus_youth_count").click(function() {
    let currentValue = parseFloat($("#input_youth_count").val());

    let newPlusVal = parseFloat(currentValue + 1);

    $("#input_youth_count").val(newPlusVal);

    let single_youth_amount = parseFloat($("#youth_amount_val").val());

    let total_youth_amount_val = (single_youth_amount * newPlusVal);

    $("#total_youth_count_val").html(newPlusVal + " Youths");
    $("#final_youth_amount_val").html("$" + total_youth_amount_val.toFixed(2));

    $("#total_youth_count_val").attr("data-total-youth", newPlusVal);
    $("#final_youth_val").val(total_youth_amount_val);

    totalFinalAmountCount();
    
    if (currentValue + 1 > 0) {
        $("#minus_youth_count").removeClass("btn-disabled");
    };
});

$("#minus_youth_count").click(function() {
    $("#plus_youth_count").removeClass("btn-disabled");
    let currentValue = parseFloat($("#input_youth_count").val());

    if (currentValue === 0) {
        return;
    };

    if (currentValue > 0) {
        let newMinusVal = parseFloat(currentValue - 1);

        $("#input_youth_count").val(newMinusVal);

        let single_youth_amount = parseFloat($("#youth_amount_val").val());

        let total_youth_amount_val = (single_youth_amount * newMinusVal);

        $("#total_youth_count_val").html(newMinusVal + " Youths");
        $("#final_youth_amount_val").html("$" + total_youth_amount_val.toFixed(2));

        $("#total_youth_count_val").attr("data-total-youth", newMinusVal);
        $("#final_youth_val").val(total_youth_amount_val);

        totalFinalAmountCount();
    };

    if (currentValue - 1 <= 0) {
        $(this).addClass("btn-disabled");
    };
});

$("#plus_child_count").click(function() {
    let currentValue = parseFloat($("#input_child_count").val());

    let newPlusVal = parseFloat(currentValue + 1);

    $("#input_child_count").val(newPlusVal);

    let single_child_amount = parseFloat($("#child_amount_val").val());

    let total_child_amount_val = (single_child_amount * newPlusVal);

    $("#total_child_count_val").html(newPlusVal + " Childs");
    $("#final_child_amount_val").html("$" + total_child_amount_val.toFixed(2));

    $("#total_child_count_val").attr("data-total-child", newPlusVal);
    $("#final_child_val").val(total_child_amount_val);

    totalFinalAmountCount();
    
    if (currentValue + 1 > 0) {
        $("#minus_child_count").removeClass("btn-disabled");
    };
});

$("#minus_child_count").click(function() {
    $("#plus_child_count").removeClass("btn-disabled");
    let currentValue = parseFloat($("#input_child_count").val());

    if (currentValue === 0) {
        return;
    };

    if (currentValue > 0) {
        let newMinusVal = parseFloat(currentValue - 1);

        $("#input_child_count").val(newMinusVal);

        let single_child_amount = parseFloat($("#child_amount_val").val());

        let total_child_amount_val = (single_child_amount * newMinusVal);

        $("#total_child_count_val").html(newMinusVal + " Childs");
        $("#final_child_amount_val").html("$" + total_child_amount_val.toFixed(2));

        $("#total_child_count_val").attr("data-total-child", newMinusVal);
        $("#final_child_val").val(total_child_amount_val);

        totalFinalAmountCount();
    };

    if (currentValue - 1 <= 0) {
        $(this).addClass("btn-disabled");
    };
});

$("#plus_infant_count").click(function() {
    let currentValue = parseFloat($("#input_infant_count").val());

    let newPlusVal = parseFloat(currentValue + 1);

    $("#input_infant_count").val(newPlusVal);

    let single_infant_amount = parseFloat($("#infant_amount_val").val());

    let total_infant_amount_val = (single_infant_amount * newPlusVal);

    $("#total_infant_count_val").html(newPlusVal + " Infants");
    $("#final_infant_amount_val").html("$" + total_infant_amount_val.toFixed(2));

    $("#total_infant_count_val").attr("data-total-infant", newPlusVal);
    $("#final_infant_val").val(total_infant_amount_val);

    totalFinalAmountCount();
    
    if (currentValue + 1 > 0) {
        $("#minus_infant_count").removeClass("btn-disabled");
    };
});

$("#minus_infant_count").click(function() {
    $("#plus_infant_count").removeClass("btn-disabled");
    let currentValue = parseFloat($("#input_infant_count").val());

    if (currentValue === 0) {
        return;
    };

    if (currentValue > 0) {
        let newMinusVal = parseFloat(currentValue - 1);

        $("#input_infant_count").val(newMinusVal);

        let single_infant_amount = parseFloat($("#infant_amount_val").val());

        let total_infant_amount_val = (single_infant_amount * newMinusVal);

        $("#total_infant_count_val").html(newMinusVal + " Infants");
        $("#final_infant_amount_val").html("$" + total_infant_amount_val.toFixed(2));

        $("#total_infant_count_val").attr("data-total-infant", newMinusVal);
        $("#final_infant_val").val(total_infant_amount_val);

        totalFinalAmountCount();
    };

    if (currentValue - 1 <= 0) {
        $(this).addClass("btn-disabled");
    };
});

$(document).on("click", "#searchActivityBtn", function () {
    searchActivity();
});

$(document).on("keypress", "#activity_search", function (e) {
    if (e.which === 13 || e.key === "Enter") {
        searchActivity();
    }
});

let debounceTimer;
$('#activity_search').on('input', function() {
    const searchTerm = $(this).val().trim();

    if (searchTerm.length > 0) {
        clearTimeout(debounceTimer);

        debounceTimer = setTimeout(function() {
            $.ajax({
                url: `/search-activity?activity=${encodeURIComponent(searchTerm)}`,
                type: 'GET',
                success: function(response) {
                    const suggestionsContainer = $('#activity-suggestions');
                    suggestionsContainer.empty();

                    if (response.flag === 1) {
                        const activities = response.data.activities;
                        const cities = response.data.cities;

                        if (activities.length > 0) {
                            suggestionsContainer.append('<div class="suggestion-header"></div>');
                            activities.forEach(activity => {
                                const cityState = [activity.city, activity.state, activity.country].filter(Boolean).join(', ');
                                const displayText = `
                                    ${activity.travelingImages && activity.travelingImages.length > 0 ? 
                                    `<img src="${activity.travelingImages[0]}" alt="Activity Image" />` : ''}
                                    <div>
                                        <p class="aname">${activity.activityName}</p>
                                        <p class="city-name">${cityState ? ' (' + cityState + ')' : ''}</p>
                                    </div>
                                `;
                                suggestionsContainer.append(`<div class="suggestion-item" data-id="${activity._id}">${displayText}</div>`);
                            });
                        } else {
                            suggestionsContainer.append('<div class="no-data-found">No Activity Found</div>');
                        }

                        if (cities.length > 0) {
                            suggestionsContainer.append('<div class="suggestion-header"></div>');
                            cities.forEach(city => {
                                suggestionsContainer.append(`
                                    <div class="city-link" data-city="${city.name}">
                                    <div class="location-icon">
                                     <svg  viewBox="0 0 16 16" fill="none" aria-hidden="true" width="100%"><path d="M9.07847 14.2446C8.7894 14.5153 8.40293 14.6666 8.00073 14.6666C7.59853 14.6666 7.21213 14.5153 6.923 14.2446C4.27535 11.7506 0.727174 8.96458 2.45751 4.91975C3.39309 2.73275 5.63889 1.33331 8.00073 1.33331C10.3626 1.33331 12.6084 2.73275 13.544 4.91975C15.2721 8.95951 11.7327 11.7592 9.07847 14.2446Z" stroke="currentColor"></path><path d="M10.3333 7.33333C10.3333 8.622 9.28863 9.66667 7.99996 9.66667C6.71129 9.66667 5.66663 8.622 5.66663 7.33333C5.66663 6.04467 6.71129 5 7.99996 5C9.28863 5 10.3333 6.04467 10.3333 7.33333Z" stroke="currentColor"></path></svg>
                                     </div>
                                        <div>
                                        <p class="city-link aname" data-city="${city.name}">${city.name}</p> 
                                        <p class="city-link city-name" data-country="${city.country}">${city.country}</p> 
                                        </div>
                                    </div>`
                                    );
                            });
                        } else {
                            suggestionsContainer.append('<div class="no-data-found">No City Found</div>');
                        }

                        suggestionsContainer.show();
                    } else {
                        suggestionsContainer.append('<div class="no-data-found">No Data Found</div>').show();
                    }
                },
                error: function(error) {
                    console.error('Error fetching activity data', error);
                }
            });
        }, 500);
    } else {
        $('#activity-suggestions').empty().hide();
    }
});

$(document).on('click', '.suggestion-item', function() {
    const selectedActivityName = $(this).text();
    const selectedActivityId = $(this).data('id');

    $('#activity_search').val(selectedActivityName);
    $('#activity_search').data('activity-id', selectedActivityId);

    $('#activity-suggestions').empty().hide();

    $('#activity_search').val('');

    window.location.href = `/activity-details/${selectedActivityId}`;
});

$("#confirmToPayment").on("click", function (e) {
    $("#p_loader").removeClass("d-none");

    e.preventDefault();
    if(!validationForm()) {
        $("#p_loader").addClass("d-none");
        return;
    };

    let booking_date = $("#booking_date").val();

    let activity_id = $("#travel_activity_id").val();

    let user_name = $("#user_full_Name").val();
    let phone_number = $("#mobile_code").val();
    let email = $("#user_email").val();
    let activity_time_slot = $(".time_slot:checked").val();
    let sanitizedPhoneNo = phone_number.replace(/\D/g, '');

    let origin_name = $("#origin_name").val();
    let destination_name = $("#destination_name").val();
    let accommodation_name = $("#accommodation_name").val();
    let disability_text = $("#disability_text").val();
    let select_tour_guide_language = $("#inputState").val();

    let total_adult_add = $("#total_adult_count_val").data("total-adult");
    let total_youth_add = $("#total_youth_count_val").data("total-youth");
    let total_child_add = $("#total_child_count_val").data("total-child");
    let total_infant_add = $("#total_infant_count_val").data("total-infant");

    let total_adult_charge = parseFloat($("#final_adult_val").val()) || 0;
    let total_youth_charge = parseFloat($("#final_youth_val").val()) || 0;
    let total_child_charge = parseFloat($("#final_child_val").val()) || 0;
    let total_infant_charge = parseFloat($("#final_infant_val").val()) || 0;

    let total_payable_charge = parseFloat($("#total_final_payable_amount").val());

    let currency_name = $("#selected-currency").data("currency-name");
    let currency_type = $("#selected-currency").data("currency-type");
    
    let country_number_code = $(".iti__selected-dial-code").html();
    let meeting_point_name = $("#select_meeting_point_name").val();
    let meet_point_latitude = $("#meet_point_latitude").val();
    let meet_point_longitude = $("#meet_point_longitude").val();

    if(isNaN(parseFloat(total_payable_charge)) || parseFloat(total_payable_charge) === 0){
        $("#p_loader").addClass("d-none");
        showToast(0, "Total payable is 0");
        return false;
    };

    const currentBookingUrl = window.location.href;

    // Trip Start Time
    let startTime = activity_time_slot.split('-')[0].trim();
    let dateStartTimeString = booking_date + ' ' + startTime;
    let formattedStartDateTime = moment(dateStartTimeString, "DD-MM-YYYY hh:mm A");
    let formatTripStartDate = formattedStartDateTime.format("DD-MM-YYYY hh:mm:ss A");

    // Trip End Time
    let endTime = activity_time_slot.split('-')[1].trim();
    let dateEndTimeString = booking_date + ' ' + endTime;
    let formattedEndDateTime = moment(dateEndTimeString, "DD-MM-YYYY hh:mm A");    
    let formatTripEndDate = formattedEndDateTime.format("DD-MM-YYYY hh:mm:ss A");

    let tripStart = moment(formatTripStartDate, "DD-MM-YYYY hh:mm:ss A");
    let currentTime = moment();
    if (currentTime.isAfter(tripStart)) {
        $("#p_loader").addClass("d-none");
        showToast(0, "Please select a valid future time slot. Selected activity time slot has already passed.");
        return false;
    };

    let payload = {
        bookingStartDate: formatTripStartDate,
        bookingEndDate: formatTripEndDate,
        activityId: activity_id,
        userName: user_name,
        phoneNo: sanitizedPhoneNo,
        email: email,
        activityTimeSlot: activity_time_slot,
        countryNumberCode: country_number_code ? country_number_code : "+1",
        originName: origin_name ? origin_name : "",
        destinationName: destination_name ? destination_name : "",
        accommodationName: accommodation_name ? accommodation_name : "",
        disabilityText: disability_text ?  disability_text : "",
        tourGuideLanguage: select_tour_guide_language ? select_tour_guide_language : "",
        totalAdultAdd: total_adult_add ? total_adult_add : 0,
        totalYouthAdd: total_youth_add ? total_youth_add : 0,
        totalChildAdd: total_child_add ? total_child_add : 0,
        totalInfantAdd: total_infant_add ? total_infant_add : 0,
        totalAdultCharge: total_adult_charge ? total_adult_charge : 0,
        totalYouthCharge: total_youth_charge ? total_youth_charge : 0,
        totalChildCharge: total_child_charge ? total_child_charge : 0,
        totalInfantCharge: total_infant_charge ? total_infant_charge : 0,
        totalPayableCharge: total_payable_charge ? total_payable_charge : 0,
        currencyName: currency_name ? currency_name : "USD",
        currencyType: currency_type ? currency_type : 1,
        currentBookingUrl: currentBookingUrl ? currentBookingUrl : "",
        meetingPointName: meeting_point_name ? meeting_point_name : "",
        meetingLongitude: meet_point_longitude ? meet_point_longitude : "",
        meetingLatitude: meet_point_latitude ? meet_point_latitude : "",
    };
    $(this).addClass("btn-disabled");

    postAjaxCall("/create-stripe-payment", payload, function (response) {
        if (response.flag === 1) {
            setTimeout(() => {
                $("#p_loader").addClass("d-none");
            }, 800);
            setTimeout(() => {
                showToast(response.flag, response.msg);
            }, 1000);
            setTimeout(() => {
                window.location.replace(response?.data?.redirectUrl);
            }, 2000);
        } else {
            if (response?.data && response?.data?.redirectUrl) {
                setTimeout(() => {
                    $("#p_loader").addClass("d-none");
                }, 800);
                setTimeout(() => {
                    showToast(response.flag, response.msg);
                }, 1000);
                setTimeout(() => {
                    window.location.replace(response?.data?.redirectUrl);
                }, 2000);
            } else {
                $("#p_loader").addClass("d-none");
                showToast(response.flag, response.msg);
                $("#confirmToPayment").removeClass("btn-disabled");
            };
        };
    });
});

function totalFinalAmountCount(){
    let totalAdultAmount = parseFloat($("#final_adult_val").val()) || 0;
    let totalYouthAmount = parseFloat($("#final_youth_val").val()) || 0;
    let totalChildAmount = parseFloat($("#final_child_val").val()) || 0;
    let totalInfantAmount = parseFloat($("#final_infant_val").val()) || 0;

    let totalPayableAmount = totalAdultAmount + totalYouthAmount + totalChildAmount + totalInfantAmount || 0;

    $("#total_final_payable_amount").val(parseFloat(totalPayableAmount));
    $("#total_payable_amount").html("$" + parseFloat(totalPayableAmount).toFixed(2));

    if(isNaN(parseFloat(totalPayableAmount)) || parseFloat(totalPayableAmount) === 0){
        $("#confirmToPayment").addClass("btn-disabled");
    } else {
        $("#confirmToPayment").removeClass("btn-disabled");
    };
};

function validationForm() {
    let userName = $("#user_full_Name").val();
    let phoneNo = $("#mobile_code").val();
    let email = $("#user_email").val();
    let activityTimeSlot = $(".time_slot:checked").val();
    let phoneNoPattern = /^\d+$/;

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+.[a-zA-Z]{2,}$/;

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


    if (!activityTimeSlot) {
        showToast(0, "Please select activity time slot.");
        return false;
    };

    if (email.length === 0) {
        showToast(0, "Please enter email address.");
        return false;
    };

    if (!emailRegex.test(email)) {
        showToast(0, "Invalid email address. Please enter a valid email address.");
        return false;
    };

    if (email?.length > 255) {
        showToast(0, "Email address is too long. Please enter a shorter email address.");
        return false;
    };

    return true;
}

function searchActivity() {
    $("#p_loader").removeClass("d-none");

    const activityName = $("#activity_search").val().trim();

    if (!activityName) {
        $("#p_loader").addClass("d-none");
        showToast(0, "Please enter an activity name.");
        return;
    }

    let payload = {
        activityName: activityName
    };

    postAjaxCall("/search-activity", payload, function (response) {
        if (response.flag === 1) {
            $("#activity_search").val("");
            window.location.href = `/activity-details/${response.data}`;
        } else {
            $("#p_loader").addClass("d-none");
            showToast(response.flag, response.msg);
        }
    });
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

function normalizeDateString(dateStr) {
    const parts = dateStr.split("-");
    if (parts.length === 3 && parts[2].length === 4) {
        const [day, month, year] = parts;
        const isoStr = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        const dateObj = new Date(isoStr);
        return isNaN(dateObj.getTime()) ? null : isoStr;
    }
    const dateObj = new Date(dateStr);
    if (!isNaN(dateObj.getTime())) {
        return dateObj.toISOString().split("T")[0];
    }
    return null;
};

function timeToMinutes(timeStr) {
    const [time, modifier] = timeStr.trim().split(' ');
    let [hours, minutes] = time.split(':').map(Number);
    if (modifier === 'PM' && hours !== 12) hours += 12;
    if (modifier === 'AM' && hours === 12) hours = 0;
    return hours * 60 + minutes;
}

function getDateFromUrl() {
    let match = window.location.href.match(/(\d{2})-(\d{2})-(\d{4})$/);
    if (match) {
        const [_, day, month, year] = match;
        return `${year}-${month}-${day}`;
    };

    return null;
};
