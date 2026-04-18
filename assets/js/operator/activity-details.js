$(document).ready(function () {
    $('#edit_activity_form').find('input, select, textarea, button').not('#edit-activity').prop('disabled', true);

    $("#remove-day-0-index-0").hide();
    $("#remove-day-1-index-0").hide();
    $("#remove-day-2-index-0").hide();
    $("#remove-day-3-index-0").hide();
    $("#remove-day-4-index-0").hide();
    $("#remove-day-5-index-0").hide();
    $("#remove-day-6-index-0").hide();

    $(".days").each(function () {
        let dayIndex = $(this).data("day-index");
        let container = getContainerByDayNumber(dayIndex);
        let timeSlots = container.find(".time-inp");

        if (timeSlots.length > 1) {
            timeSlots.each(function (index) {
                if (index < timeSlots.length - 1) {
                    $(this).find(".add_new_time").hide();
                };
            });
        }

        container.find(".time-inp").each(function (index) {
            let cutOffTimeInput = $(this).find("input[name='cutOffTime']");
            let cutOffTime = cutOffTimeInput.val().trim();

            if (!cutOffTime && index > 0) {
                cutOffTimeInput.hide();
            }
        });
    });        
});

document.addEventListener("DOMContentLoaded", () => {
    const imgUploadBtn = document.getElementById("imgUploadBtn");
    const fileInput = document.getElementById("fileInput");
    imgUploadBtn.addEventListener("click", () => {
        fileInput.click();
    });

    flatpickr(".time-picker", {
        enableTime: true,
        noCalendar: true,
        dateFormat: "h:i K", // 12-hour format with AM/PM
        time_24hr: false,
        minuteIncrement: 1,
        wrap: false
    });
});

// Add Meeting Point HTML
$(document).on("click", "#addMeetingPoint", function (e) {
    e.preventDefault();

    let addMeetingHtml = `
        <div class="meeting_point_block">
            <span class='meeting_space'></span>
            <div class="row g-2">
                <div class="col-12">
                    <div class="mb-0">
                        <div class="d-flex align-items-center justify-content-between">
                        <label for="meetingPointName" class="form-label">Enter Meeting Point Name</label> 
                        <button class="remove-btn remove_meeting_point_btn"></button></div>
                        <input type="text" class="form-control" name="mettingPointName" data-text-limit="50" placeholder="Enter meeting point name" />
                    </div>
                </div>
                <div class="col-12 col-lg-6">
                    <div class="mb-0">
                        <label for="latitude" class="form-label">Latitude</label>
                        <input type="text" class="form-control" name="latitude" placeholder="Enter Latitude" />
                    </div>
                </div>
                <div class="col-12 col-lg-6">
                    <div class="mb-0">
                        <label for="longitude" class="form-label">Longitude</label>
                        <input type="text" class="form-control" name="longitude" placeholder="Enter Longitude" />
                    </div>
                </div>
            </div>
        </div>
    `;

    $(".meeting_point_div").append(addMeetingHtml);
});

// Remove Meeting Point
$(document).on("click", ".remove_meeting_point_btn", function (e) {
    e.preventDefault();
    $(this).closest(".meeting_point_block").remove();
});

let inclusionCount = $(".package_inclusion_add_div .package-inclusion").length || 1;
let exclusionCount = $(".package_exclusion_add_div .package-exclusion").length || 1;

// Add Package Inclusion
$(document).on("click", "#add_new_package_inclusion", function (e) {
    e.preventDefault();
    inclusionCount++;

    let addPackageInclusionHtml = `
        <div class="col-12 package_inclusion_block" style="margin-top: 10px;">
            <div class="mb-0 package-inclusion">
                <div class="d-flex align-items-center justify-content-between">
                    <label for="inclusion_${inclusionCount}" class="form-label inclusion-label">Inclusion ${inclusionCount}</label>
                    <button class="remove-btn remove_package_inclusion_btn"></button>
                </div>
                <input type="text" class="form-control" name="packageInclusion" placeholder="Enter detail here" />
            </div>
        </div>`;

    $(".package_inclusion_add_div").append(addPackageInclusionHtml);
    updateInclusionLabels();
});

$(document).on("click", ".remove_package_inclusion_btn", function (e) {
    e.preventDefault();
    $(this).closest('.package_inclusion_block').remove();
    inclusionCount = $(".package_inclusion_block").length;
    updateInclusionLabels();
});

// Add Package Exclusion
$(document).on("click", "#add_new_package_exclusion", function (e) {
    e.preventDefault();
    exclusionCount++;
    let addPackageExclusionHtml = `
        <div class="col-12  package_exclusion_block" style="margin-top: 10px;">
            <div class="mb-0 package-exclusion">
                 <div class="d-flex align-items-center justify-content-between">
                     <label for="exclusion_${exclusionCount}" class="form-label exclusion-label">Exclusion ${exclusionCount}</label>
                    <button class="remove-btn remove_package_exclusion_btn"></button>
                </div>
                <input type="text" class="form-control" name="packageExclusion" placeholder="Enter detail here" />
            </div>
        </div>`;
    $(".package_exclusion_add_div").append(addPackageExclusionHtml);
    updateExclusionLabels();
});

$(document).on("click", ".remove_package_exclusion_btn", function (e) {
    e.preventDefault();
    $(this).closest('.package_exclusion_block').remove();
    exclusionCount = $(".package_exclusion_block").length;
    updateExclusionLabels();
});

let itineraryCount = $(".itinerary_div .iti-form").length || 1;

// Add Itinerary
$(document).on("click", "#add_new_itinerary", function (e) {
    e.preventDefault();
    itineraryCount++;

    let itineraryHtml = `
        <span class='itinerary_space'></span>
        <div class="row gy-3 gx-2 iti-form">
            <div class="iti-item-no">${itineraryCount}</div>
            <div class="col-12 col-lg-6">
                <div class="mb-0">
                    <label for="itineraryName_${itineraryCount}" class="form-label">Itinerary</label>
                    <input type="text" name="itineraryName" class="form-control" placeholder="Enter Details" />
                </div>
            </div>
            <div class="col-12 col-lg-6">
                <div class="mb-0">
                    <div class="d-flex align-items-center justify-content-between">
                    <label for="itineraryTime_${itineraryCount}" class="form-label">Time</label>
                    <button type="button" class="remove-btn remove_itinerary_btn"></button>
                    </div>
                    <select name="itineraryTime" class="form-select">
                            <option value="15" selected>15 Minutes</option>
                            <option value="30" >30 minutes</option>
                            <option value="45" >45 minutes</option>
                            <option value="60">1 hour</option>
                    </select>
                </div>
            </div>
            <div class="col-12">
                <div class="mb-0">
                    <label for="itineraryDescription_${itineraryCount}" class="form-label">Details</label>
                    <textarea class="form-control itinerary_description" rows="5" name="itineraryDescription" placeholder="Enter Details"></textarea>
                </div>
            </div>
        </div>
    `;

    $(".itinerary_div").append(itineraryHtml);
    updateItineraryNumbers();
});

// Remove Itinerary
$(document).on("click", ".remove_itinerary_btn", function (e) {
    e.preventDefault();
    $(this).closest('.iti-form').prev('.itinerary_space').remove();
    $(this).closest('.iti-form').remove();
    itineraryCount = $(".itinerary_div .iti-form").length;
    updateItineraryNumbers();
});

let dayIndices = {};
$(document).on("click", ".add_new_time", function () {
    let dayNumber = $(this).data("day-name");
    let container = getContainerByDayNumber(dayNumber);

    if (container.find(".text-center.mx-auto").length) {
        container.removeClass("w-100");
        container.empty();
    };

    dayIndices[dayNumber] = (dayIndices[dayNumber] || 0) + 1;
    let index = dayIndices[dayNumber];

    const newSlot = $(getTimeSlotHTML(dayNumber, index));
    container.append(newSlot);

    newSlot.find(".time-picker").flatpickr({
        enableTime: true,
        noCalendar: true,
        dateFormat: "h:i K",
        time_24hr: false,
        minuteIncrement: 1,
        wrap: false
    });

    $(this).hide();

    let prevIndex = index - 1;
    if (prevIndex > 0) {
        $(`#remove-day-${dayNumber}-index-${prevIndex}`).show();
    }
});

$(document).on("click", ".remove_time", function () {
    let dayNumber = $(this).data("day-name");
    let container = getContainerByDayNumber(dayNumber);

    let currentSlot = $(this).closest(".time-inp");
    currentSlot.remove();

    let remainingSlots = container.find(".time-inp");
    if (remainingSlots.length > 0) {
        let lastSlot = remainingSlots.last();
        let lastIndex = remainingSlots.index(lastSlot);
        lastSlot.find(".add_new_time").show();
    } else {
        container.addClass("w-100");
        container.html(getUnavailableHTML(dayNumber));
    }
});

$(document).on("change", ".day-checkbox", function () {
    let dayNumber = $(this).data("day-index");
    let container = getContainerByDayNumber(dayNumber);

    if ($(this).prop("checked")) {
        container.removeClass("w-100");
        let timeSlots = operatingHours[dayNumber]?.dateTime || [];
        timeSlots.forEach((slot, i) => {
            container.append(getTimeSlotHTML(dayNumber, slot.startTime, slot.endTime, slot.cutOffTime));
        });
    };
});

$(".text_input_limit").on("input", function (event) {
    const maxLength = $(this).data("text-limit");
    const currentValue = $(this).val();
    if (currentValue.length > maxLength) {
        $(this).val(currentValue.substring(0, maxLength));
    };
});

$(".input_number_key").on("input", function (event) {
    let value = $(this).val();
    let numericValue = value.replace(/[^0-9.]/g, "").slice(0, 12);

    $(this).val(formateThreeDigitAmount(numericValue));
});

$(".input_number_key").on("keydown", function (event) {
    let key = event.which || event.keyCode;

    if (key === 189 || key === 109) {
        event.preventDefault();
    };

    if (event.key === "." || event.keyCode === 190 || event.keyCode === 110) {
        event.preventDefault();
    };
});

$('#edit-activity').on('click', function () {
    $('#edit_activity_form').find('input, select, textarea, button').prop('disabled', false);
    $(this).prop('disabled', true);

    if ($('#offer_is_live').prop('checked') === false) {
        $("#discount_red_dot_view").addClass("d-none");
        $('#discounted_amount').prop('disabled', true);
    } else {
        $('#discounted_amount').prop('disabled', false);
    };

    if ($('#is_child_val_switch').prop('checked') === false) {
        $('#child_amount').prop('disabled', true);
        $("#child_red_dot_view ").addClass("d-none");
    } else {
        $('#child_amount').prop('disabled', false);
    };

    if ($('#is_infant_val_switch').prop('checked') === false) {
        $('#infant_amount').prop('disabled', true);
        $("#infant_red_dot_view").addClass("d-none");
    } else {
        $('#infant_amount').prop('disabled', false);
    };

    if ($('#is_youth_val_switch').prop('checked') === false) {
        $('#youth_amount').prop('disabled', true);
        $("#youth_red_dot_view").addClass("d-none");
    } else {
        $('#youth_amount').prop('disabled', false);
    }
});

$("#offer_is_live").on("change", function (e) {
    $("#discounted_amount").val("0");
    if ($(this).is(":checked")) {
        $("#discount_red_dot_view").removeClass("d-none");
        $('#discounted_amount').prop('disabled', false);
    } else {
        $("#discount_red_dot_view").addClass("d-none");
        $('#discounted_amount').prop('disabled', true);
    };
});

$("#is_child_val_switch").on("change", function (e) {
    $("#child_amount").val("0");
    if ($(this).is(":checked")) {
        $("#child_red_dot_view").removeClass("d-none");
        $('#child_amount').prop('disabled', false);
    } else {
        $("#child_red_dot_view").addClass("d-none");
        $('#child_amount').prop('disabled', true);
    };
});

$("#is_infant_val_switch").on("change", function (e) {
    $("#infant_amount").val("0");
    if ($(this).is(":checked")) {
        $("#infant_red_dot_view").removeClass("d-none");
        $('#infant_amount').prop('disabled', false);
    } else {
        $("#infant_red_dot_view").addClass("d-none");
        $('#infant_amount').prop('disabled', true);
    };
});

$("#is_youth_val_switch").on("change", function (e) {
    $("#youth_amount").val("0");
    if ($(this).is(":checked")) {
        $("#youth_red_dot_view").removeClass("d-none");
        $('#youth_amount').prop('disabled', false);
    } else {
        $("#youth_red_dot_view").addClass("d-none");
        $('#youth_amount').prop('disabled', true);
    };
});

$.get("https://countriesnow.space/api/v0.1/countries", function (data) {
    const countries = data.data;
    $.each(countries, function (i, country) {
        $('#country').append(`<option value="${country.country}">${country.country}</option>`);
    });
});

$('#country').on('change', function () {
    let selectedCountry = $(this).val();
    $('#state').prop('disabled', true);
    $('#city').prop('disabled', true);
    $('#state').html('<option value="">Loading...</option>');
    $('#city').html('<option value="">Select City</option>');

    $.ajax({
        url: "https://countriesnow.space/api/v0.1/countries/states",
        method: "POST",
        data: JSON.stringify({ country: selectedCountry }),
        contentType: "application/json",
        success: function (response) {
            $('#state').html('<option value="">Select State</option>');
            $.each(response.data.states, function (i, state) {
                $('#state').append(`<option value="${state.name}">${state.name}</option>`);
            });
            $('#state').prop('disabled', false);
        },
        error: function () {
            $('#state').html('<option value="">Failed to load states</option>');
            $('#state').prop('disabled', false);
        }
    });
});

$('#state').on('change', function () {
    let selectedCountry = $('#country').val();
    let selectedState = $(this).val();

    $('#city').prop('disabled', true);
    $('#city').html('<option value="">Loading...</option>');

    $.ajax({
        url: "https://countriesnow.space/api/v0.1/countries/state/cities",
        method: "POST",
        data: JSON.stringify({ country: selectedCountry, state: selectedState }),
        contentType: "application/json",
        success: function (response) {
            $('#city').html('<option value="">Select City</option>');

            $.each(response.data, function (i, city) {
                $('#city').append(`<option value="${city}">${city}</option>`);
            });

            $('#city').prop('disabled', false);
        },
        error: function () {
            $('#city').html('<option value="">Failed to load cities</option>');
            $('#city').prop('disabled', false);
        }
    });
});

const selectedInput = document.getElementById('audio_guide_select');
const optionsContainer = document.getElementById('optionsContainer');

const languageMap = {
    '1': 'English',
    '2': 'French',
    '3': 'Spanish'
};

const checkboxes = optionsContainer.querySelectorAll('input[type="checkbox"]');

selectedInput.addEventListener('click', () => {
    optionsContainer.style.display = optionsContainer.style.display === 'block' ? 'none' : 'block';
});

checkboxes.forEach(checkbox => {
    checkbox.addEventListener('change', () => {
        const selected = Array.from(checkboxes).filter(cb => cb.checked).map(cb => languageMap[cb.value]);

        selectedInput.value = selected.join(', ') || 'Select language';
    });
});

document.addEventListener('click', (e) => {
    if (!e.target.closest('.multi-select')) {
        optionsContainer.style.display = 'none';
    };
});

// Edit Activity API Call
$("#edit_activity_details").on("click", function (e) {
    $("#p_loader").removeClass("d-none");

    e.preventDefault();
    if (!validationActivityForm()) {
        $("#p_loader").addClass("d-none");
        return;
    };

    const formData = new FormData();
    const activityId = $('#activityId').val();
    const activity_name = $("#activity_name").val();
    const activity_duration = $("#activity_duration").val();
    const total_activity_format_value = $("#total_activity_value").val();
    const total_activity_value = parseFloat(total_activity_format_value.replace(/,/g, ''));
    const discounted_amount_format_value = $("#discounted_amount").val();
    const discounted_amount = parseFloat((discounted_amount_format_value || '0').replace(/,/g, '')) || 0;
    const child_amount_format_value = $("#child_amount").val();
    const child_amount = parseFloat((child_amount_format_value || '0').replace(/,/g, '')) || 0;
    const infant_amount_format_value = $("#infant_amount").val();
    const infant_amount = parseFloat((infant_amount_format_value || '0').replace(/,/g, '')) || 0;
    const youth_amount_format_value = $("#youth_amount").val();
    const youth_amount = parseFloat((youth_amount_format_value || '0').replace(/,/g, '')) || 0;
    const audio_guide_select =  Array.from(checkboxes).filter(cb => cb.checked).map(cb => languageMap[cb.value]);
    const description = $("#description").val();
    const ticket_policy = $("#ticket_policy").val();
    const refund_policy = $("#refund_policy").val();
    const country  = $("#country").val();
    const city = $("#city").val();
    const state = $("#state").val();
    const meetingEndPointName = $("#meeting_end_point_name").val();
    const meetingendLongitude = $("#meeting_end_latitude").val();
    const meetingEndLatitude = $("#meeting_end_longitude").val();

    let offer_is_live;
    if ($("#offer_is_live").is(":checked")) {
        offer_is_live = true;
    } else {
        offer_is_live = false;
    };

    let is_child_val_switch;
    if ($("#is_child_val_switch").is(":checked")) {
        is_child_val_switch = true;
    } else {
        is_child_val_switch = false;
    };

    let is_infant_val_switch;
    if ($("#is_infant_val_switch").is(":checked")) {
        is_infant_val_switch = true;
    } else {
        is_infant_val_switch = false;
    };

    let is_youth_val_switch;
    if ($("#is_youth_val_switch").is(":checked")) {
        is_youth_val_switch = true;
    } else {
        is_youth_val_switch = false;
    };

    let is_24_cancelation_policy;
    if ($("#is_24_cancelation_policy").is(":checked")) {
        is_24_cancelation_policy = true;
    } else {
        is_24_cancelation_policy = false;
    };

    let is_skip_line;
    if ($("#is_skip_line").is(":checked")) {
        is_skip_line = true;
    } else {
        is_skip_line = false;
    };

    if(audio_guide_select.length === 0){
        $("#p_loader").addClass("d-none");
        showToast(0, "Please select an audio guide language.");
        return;
    };

    // Meeting Points
    const mettingPointNames = document.querySelectorAll('input[name="mettingPointName"]');
    const latitudes = document.querySelectorAll('input[name="latitude"]');
    const longitudes = document.querySelectorAll('input[name="longitude"]');

    const meetingPoints = [];

    for (let i = 0; i < mettingPointNames.length; i++) {
        const name = mettingPointNames[i].value.trim();
        const latitude = latitudes[i].value.trim();
        const longitude = longitudes[i].value.trim();

        if (name && latitude && longitude) {
            meetingPoints.push({ mettingPointName: name, latitude, longitude });
        }
    };

    // Package Inclusions
    const packageInclusion = Array.from(document.querySelectorAll('.package_inclusion_add_div input[name="packageInclusion"]')).map(input => input.value.trim()).filter(Boolean);

    // Package Exclusions
    const packageExclusion = Array.from(document.querySelectorAll('.package_exclusion_add_div input[name="packageExclusion"]')).map(input => input.value.trim()).filter(Boolean);

    // Itinerary
    const itinerary = Array.from(document.querySelectorAll('.itinerary_div .iti-form'))
        .map(item => ({
            itineraryName: item.querySelector('input[name="itineraryName"]').value.trim(),
            time: item.querySelector('select[name="itineraryTime"]').value.trim(),
            details: item.querySelector('textarea[name="itineraryDescription"]').value.trim()
        })).filter(item => item.itineraryName && item.time && item.details);

    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    let isAnyDaySelected = false;
    let hasTimeError = false; 

    $(".days").each(function (i) {
        const isSelected = $(this).find('input[name="isDaySelected"]').is(":checked");
    
        if (isSelected) {
            isAnyDaySelected = true;
    
            $(this).find(".time-inp").each(function (j) {
                const startTime = $(this).find('input[name="startTime"]').val();
                const endTime = $(this).find('input[name="endTime"]').val();
                let cutOffTime = $(this).find('input[name="cutOffTime"]').val();

                if (!cutOffTime) {
                    cutOffTime = " "; 
                    $(this).find('input[name="cutOffTime"]').val(cutOffTime);
                }
                
                if(days[i] === 'Monday' && j === 0){
                    if (!startTime || !endTime || !cutOffTime) {
                        $("#p_loader").addClass("d-none");
                        showToast(0, `Please fill all time fields for ${days[i]}, slot ${j + 1}`);
                        hasTimeError = true; 
                        return false;
                    };
                }  else if(days[i] === 'Monday' && j !== 0){
                    if (!startTime || !endTime ) {
                        $("#p_loader").addClass("d-none");
                        showToast(0, `Please fill  start time and end time fields for ${days[i]}, slot ${j + 1}`);
                        hasTimeError = true;
                        return false;
                    };
                };

                if(days[i] === 'Tuesday' && j === 0){
                    if (!startTime || !endTime || !cutOffTime) {
                        $("#p_loader").addClass("d-none");
                        showToast(0, `Please fill all time fields for ${days[i]}, slot ${j + 1}`);
                        hasTimeError = true; 
                        return false;
                    } 
                } else if(days[i] === 'Tuesday' && j !== 0){
                    if (!startTime || !endTime ) {
                        $("#p_loader").addClass("d-none");
                        showToast(0, `Please fill  start time and end time fields for ${days[i]}, slot ${j + 1}`);
                        hasTimeError = true;
                        return false;
                    }
                }

                if(days[i] === 'Wednesday' && j === 0){
                    if (!startTime || !endTime || !cutOffTime) {
                        $("#p_loader").addClass("d-none");
                        showToast(0, `Please fill all time fields for ${days[i]}, slot ${j + 1}`);
                        hasTimeError = true; 
                        return false;
                    } 
                } else if(days[i] === 'Wednesday' && j !== 0){
                    if (!startTime || !endTime ) {
                        $("#p_loader").addClass("d-none");
                        showToast(0, `Please fill  start time and end time fields for ${days}, slot ${j + 1}`);
                        hasTimeError = true;
                        return false;
                    }
                }

                if(days[i] === 'Thursday' && j === 0){
                    if (!startTime || !endTime || !cutOffTime) {
                        $("#p_loader").addClass("d-none");
                        showToast(0, `Please fill all time fields for ${days[i]}, slot ${j + 1}`);
                        hasTimeError = true; 
                        return false;
                    } 
                } else if(days[i] === 'Thursday' && j !== 0){
                    if (!startTime || !endTime ) {
                        $("#p_loader").addClass("d-none");
                        showToast(0, `Please fill  start time and end time fields for  ${days[i]}, slot ${j + 1}`);
                        hasTimeError = true;
                        return false;
                    }
                }

                if(days[i] === 'Friday' && j === 0){
                    if (!startTime || !endTime || !cutOffTime) {
                        $("#p_loader").addClass("d-none");
                        showToast(0, `Please fill all time fields for ${days[i]}, slot ${j + 1}`);
                        hasTimeError = true; 
                        return false;
                    } 
                } else if(days[i] === 'Friday' && j !== 0){
                    if (!startTime || !endTime ) {
                        $("#p_loader").addClass("d-none");
                        showToast(0, `Please fill  start time and end time fields for ${days[i]}, slot ${j + 1}`);
                        hasTimeError = true;
                        return false;
                    }
                }

                if(days[i] === 'Saturday' && j === 0){
                    if (!startTime || !endTime || !cutOffTime) {
                        $("#p_loader").addClass("d-none");
                        showToast(0, `Please fill all time fields for ${days[i]}, slot ${j + 1}`);
                        hasTimeError = true; 
                        return false;
                    } 
                } else if(days[i] === 'Saturday' && j !== 0){
                    if (!startTime || !endTime ) {
                        $("#p_loader").addClass("d-none");
                        showToast(0, `Please fill  start time and end time fields for ${days[i]}, slot ${j + 1}`);
                        hasTimeError = true;
                        return false;
                    }
                }

                if(days[i] === 'Sunday' && j === 0){
                    if (!startTime || !endTime || !cutOffTime) {
                        $("#p_loader").addClass("d-none");
                        showToast(0, `Please fill all time fields for ${days[i]}, slot ${j + 1}`);
                        hasTimeError = true; 
                        return false;
                    } 
                } else if(days[i] === 'Sunday' && j !== 0){
                    if (!startTime || !endTime ) {
                        $("#p_loader").addClass("d-none");
                        showToast(0, `Please fill  start time and end time fields for ${days[i]}, slot ${j + 1}`);
                        hasTimeError = true;
                        return false;
                    }
                }
            });

            if (hasTimeError) return false; 
        };
    });

    if (hasTimeError) {
        return false; 
    };
    if (!isAnyDaySelected) {
        $("#p_loader").addClass("d-none");
        showToast(0, `Please select any one Operating hour`);
        return false;
    };

    const operatingHours = [];
    $(".days").each(function (i) {
        const day = days[i];
        const isSelected = $(this).find('input[name="isDaySelected"]').is(":checked");
        const dateTime = [];

        $(this).find(".time-inp").each(function () {
            const start_time_val = $(this).find('input[name="startTime"]').val().trim();
            const end_time_val = $(this).find('input[name="endTime"]').val().trim();
            const cut_off_time_val = $(this).find('input[name="cutOffTime"]').val().trim();

            const startTime = formatTimeTo12HourWithLeadingZero(start_time_val);
            const endTime = formatTimeTo12HourWithLeadingZero(end_time_val);
            const cutOffTime = cut_off_time_val ? formatTimeTo12HourWithLeadingZero(cut_off_time_val) : "";

            if (startTime && endTime) {
                dateTime.push({
                    startTime,
                    endTime,
                    cutOffTime
                });
            }
        });

        operatingHours.push({
            isSelected,
            day,
            dateTime
        });
    });

    formData.append('activityId', activityId)
    formData.append('activityName', activity_name);
    formData.append('activityDuration', activity_duration);
    formData.append('totalValue', total_activity_value);
    formData.append('discountValue', discounted_amount);
    formData.append('isOfferLive', offer_is_live);
    formData.append('isChildInclude', is_child_val_switch);
    formData.append('childValue', child_amount);
    formData.append('isInfantInclude', is_infant_val_switch);
    formData.append('infantValue', infant_amount);
    formData.append('isYouthInclude', is_youth_val_switch);
    formData.append('youthValue', youth_amount);
    formData.append('audioLanguage', audio_guide_select);
    formData.append('activityDetails', description);
    formData.append('ticketPolicy', ticket_policy);
    formData.append('refundPolicy', refund_policy);
    formData.append('is24CancelationPolicyView', is_24_cancelation_policy);
    formData.append('isSkipLine', is_skip_line);
    formData.append('meetingPoint', JSON.stringify(meetingPoints));
    formData.append('packageInclusion', JSON.stringify(packageInclusion));
    formData.append('packageExclusion', JSON.stringify(packageExclusion));
    formData.append('itinerary', JSON.stringify(itinerary));
    formData.append('operatingHours', JSON.stringify(operatingHours));
    formData.append('city', city);
    formData.append('state', state);
    formData.append('country', country);
    formData.append('meetingEndPointName', meetingEndPointName);
    formData.append('meetingendLongitude', meetingendLongitude);
    formData.append('meetingEndLatitude',  meetingEndLatitude);

    for (let i = 0; i < filesArray.length; i++) {
        formData.append('images[]', filesArray[i]);
    };

    $(this).addClass("btn-disabled");

    postFileCall("/edit-activity", formData, function (response) {
        if (response.flag === 1) {
            showToast(response.flag, response.msg);
            setTimeout(() => {
                $("#p_loader").addClass("d-none");
            }, 800);
            
            setTimeout(() => {
                window.location.href = "/activity";
            }, 2000);
        } else {
            $("#p_loader").addClass("d-none");
            showToast(response.flag, response.msg);
            $("#edit_activity_details").removeClass("btn-disabled");
        };
    });
});

const fileInput = $('#fileInput');
const replaceInput = $(".replaceFileInput")
const imgUploadBtn = $('#imgUploadBtn');
const uploadedImgPreview = $('#uploaded-img-preview');
const filesArray = [];

let a = uploadedImgPreview.data("images");

a.split(",").forEach((img, index) => {
    filesArray.push(img);
});

fileInput.on('change', function (event) {
    event.preventDefault();
    let alreadyUploadedFilesInPreview = uploadedImgPreview.children().length;
    alreadyUploadedFilesInPreview = alreadyUploadedFilesInPreview > 0 ? alreadyUploadedFilesInPreview : null;
    handleFiles(event.target.files, null, alreadyUploadedFilesInPreview);
});

imgUploadBtn.on('dragover', function (e) {
    e.preventDefault();
});

imgUploadBtn.on('drop', function (e) {
    e.preventDefault();
    const files = e.originalEvent.dataTransfer.files
    handleFiles(files);
});

$(document).on("click", ".replace-image", function (e) {
    e.preventDefault();
    const replaceInput = $(this).closest(".uploaded-img-item").find(".replaceFileInput");
    replaceInput.click();
    const fileIndex = $(this).data("index");

    replaceInput.off("change").on("change", function (e) {
        handleFiles(e.target.files, fileIndex);
    });
})

$(document).on("click", ".remove-image", function (e) {
    e.preventDefault();
    const fileIndex = $(this).data("index");
    filesArray.splice(fileIndex, 1);
    $(this).closest(".uploaded-img-item").remove();
    updateDataIndexes();
})

$(document).on("dragover", ".uploaded-img-item", function (e) {
    e.preventDefault();
})

$(document).on("dragstart", ".uploaded-img-item", function (e) {
    e.originalEvent.dataTransfer.setData("dragDivId", $(this).attr("id"));
})

$(document).on("drop", ".uploaded-img-item", function (e) {
    e.preventDefault();
    const droppedDivId = e.originalEvent.dataTransfer.getData("dragDivId");
    const droppedDivImage = $(`#${droppedDivId}`).find("img").attr("src");
    const droppedDivImageName = $(`#${droppedDivId}`).find(".replace-image").data("img-name");

    const toBeReplacedDivId = $(this).attr("id");
    const toBeReplacedDivImage = $(`#${toBeReplacedDivId}`).find("img").attr("src");
    const toBeReplacedDivImageName = $(`#${toBeReplacedDivId}`).find(".replace-image").data("img-name");

    $(`#${droppedDivId}`).find("img").attr("src", toBeReplacedDivImage);
    $(`#${droppedDivId}`).find(".replace-image").attr("data-img-name", toBeReplacedDivImageName);
    $(`#${droppedDivId}`).find(".remove-image").attr("data-img-name", toBeReplacedDivImageName);

    $(`#${toBeReplacedDivId}`).find("img").attr("src", droppedDivImage);
    $(`#${toBeReplacedDivId}`).find(".replace-image").attr("data-img-name", droppedDivImageName);
    $(`#${toBeReplacedDivId}`).find(".remove-image").attr("data-img-name", droppedDivImageName);

    const droppedDivIndex = $(`#${droppedDivId}`).find(".replace-image").data("index");
    const toBeReplacedDivIndex = $(`#${toBeReplacedDivId}`).find(".replace-image").data("index");

    const temp = filesArray[droppedDivIndex];
    filesArray[droppedDivIndex] = filesArray[toBeReplacedDivIndex];
    filesArray[toBeReplacedDivIndex] = temp;
})

function validationActivityForm() {
    const activity_name = $("#activity_name").val();
    const total_activity_format_value = $("#total_activity_value").val();
    const total_activity_value = parseFloat(total_activity_format_value.replace(/,/g, ''));
    const discounted_amount_format_value = $("#discounted_amount").val();
    const discounted_amount = parseFloat(discounted_amount_format_value.replace(/,/g, ''));
    const child_amount_format_value = $("#child_amount").val();
    const child_amount = parseFloat(child_amount_format_value.replace(/,/g, ''));
    const infant_amount_format_value = $("#infant_amount").val();
    const infant_amount = parseFloat(infant_amount_format_value.replace(/,/g, ''));
    const youth_amount_format_value = $("#youth_amount").val();
    const youth_amount = parseFloat(youth_amount_format_value.replace(/,/g, ''));
    const audio_guide_select = $("#audio_guide_select").val();
    const description = $("#description").val();
    const ticket_policy = $("#ticket_policy").val();
    const refund_policy = $("#refund_policy").val();
    const offer_is_live = $("#offer_is_live").is(":checked");
    const is_child_val_switch = $("#is_child_val_switch").is(":checked");
    const is_infant_val_switch = $("#is_infant_val_switch").is(":checked");
    const is_youth_val_switch = $("#is_youth_val_switch").is(":checked");
    const mettingPointNames = document.querySelectorAll('input[name="mettingPointName"]');
    const latitudes = document.querySelectorAll('input[name="latitude"]');
    const longitudes = document.querySelectorAll('input[name="longitude"]');
    const inclusionInputs = document.querySelectorAll('.package_inclusion_add_div input[name="packageInclusion"]');
    const exclusionInput = document.querySelectorAll('.package_exclusion_add_div input[name="packageExclusion"]');
    const itineraryItems = document.querySelectorAll('.itinerary_div .iti-form');
    const country  = $("#country").val();
    const city = $("#city").val();
    const state = $("#state").val();
    const meeting_end_point_name =  $("#meeting_end_point_name").val();
    const meeting_end_latitude =  $("#meeting_end_latitude").val();
    const meeting_end_longitude =  $("#meeting_end_longitude").val();

    if (!activity_name) {
        showToast(0, "Please enter activity name");
        return false;
    };

    if (activity_name?.length < 3) {
        showToast(0, "Activity name must be atleast 3 characters");
        return false;
    };

    if (activity_name?.length > 50) {
        showToast(0, "The Activity Name field should not be more than 50 characters");
        return false;
    };

    if (parseFloat(total_activity_value) === "" || parseFloat(total_activity_value) === 0 || isNaN(parseFloat(total_activity_value))) {
        showToast(0, "Please enter total value.");
        return false;
    };

    if (offer_is_live) {
        if (parseFloat(discounted_amount) === "" || parseFloat(discounted_amount) === 0 || isNaN(parseFloat(discounted_amount))) {
            showToast(0, "Please enter discounted value.");
            return false;
        };
    };

    if (is_child_val_switch) {
        if (parseFloat(child_amount) === "" || parseFloat(child_amount) === 0 || isNaN(parseFloat(child_amount))) {
            showToast(0, "Please enter child value.");
            return false;
        };
    };

    if (is_infant_val_switch) {
        if (parseFloat(infant_amount) === "" || parseFloat(infant_amount) === 0 || isNaN(parseFloat(infant_amount))) {
            showToast(0, "Please enter infant value.");
            return false;
        };
    };

    if (is_youth_val_switch) {
        if (parseFloat(youth_amount) === "" || parseFloat(youth_amount) === 0 || isNaN(parseFloat(youth_amount))) {
            showToast(0, "Please enter youth value.");
            return false;
        };
    };

    if(!country) {
        showToast(0, "Please enter country name");
        return false;
    };
    if(!state) {
        showToast(0, "Please enter state name");
        return false;
    };

    for (let i = 0; i < mettingPointNames.length; i++) {
        if (i === 0) {
            const name = mettingPointNames[i].value.trim();
            const lat = latitudes[i].value.trim();
            const lng = longitudes[i].value.trim();
    
            if (!name || !lat || !lng) {
                showToast(0, `Please fill all required fields in the first Meeting Point`);
                return false;
            };
            break;
        };
    };

    if (!meeting_end_point_name) {
        showToast(0, "Please Enter End Point Name.");
        return false;
    };

    if (!meeting_end_latitude) {
        showToast(0, "Please enter meeting latitude.");
        return false;
    };

    if (!meeting_end_longitude) {
        showToast(0, "Please enter meeting longitude.");
        return false;
    };

    if (!description) {
        showToast(0, "Please enter description.");
        return false;
    };

    if (!ticket_policy) {
        showToast(0, "Please enter ticket policy.");
        return false;
    };

    if (!refund_policy) {
        showToast(0, "Please enter refund policy.");
        return false;
    };

    if (!inclusionInputs[0].value.trim()) {
        showToast(0, "Package Inclusions field  is required.");
        return false;
    }
    
    if (!exclusionInput[0].value.trim()) {
        showToast(0, "Package Exclusion field  is required.");
        return false;
    }

    for (let i = 0; i < itineraryItems.length; i++) {
        if (i === 0) {
            const name = itineraryItems[i].querySelector('input[name="itineraryName"]').value.trim();
            const time = itineraryItems[i].querySelector('select[name="itineraryTime"]').value.trim();
            const desc = itineraryItems[i].querySelector('textarea[name="itineraryDescription"]').value.trim();

            if (!name || !time || !desc) {
                showToast(0, `Please fill all fields in Itinerary `);
                return false;
            }
        }
        break;
    };

    if (filesArray?.length < 5) {
        showToast(0, "Please select minimum 5 images upload");
        return false;
    };

    return true;
};

function updateInclusionLabels() {
    $(".package_inclusion_block").each(function (index) {
        $(this).find("label.inclusion-label").html("Inclusion " + (index + 1) );
    });
}

function updateExclusionLabels() {
    $(".package_exclusion_block").each(function (index) {
        $(this).find("label.exclusion-label").html("Exclusion " + (index + 1) );
    });
}

function getContainerByDayNumber(dayNumber) {
    return $(`#day-${dayNumber}`);
}

function getTimeSlotHTML(dayNumber, index) {
    return `
        <div class="d-flex align-items-center time-inp gap-2" style="margin-top: 10px;">
            <input class="time-picker" name="startTime" placeholder="Time">
            -
            <input class="time-picker" name="endTime" placeholder="Time">
            <span class="action-btn-group d-flex align-items-center ms-2 gap-2">
                <button type="button" class="add_new_time" id="add-day-${dayNumber}-index-${index}" data-day-name="${dayNumber}">
                    <img src="/images/plus-icon.svg" alt="">
                </button>
                <button type="button" class="remove_time" id="remove-day-${dayNumber}-index-${index}" data-day-name="${dayNumber}">
                    <img src="/images/close-icon.svg" alt="">
                </button>
            </span>
        </div>
    `;
}

// HTML for "Unavailable" state
function getUnavailableHTML(dayNumber) {
    return `
        <div class="d-flex align-items-center time-inp gap-2 w-100">
            <span class="text-center mx-auto">Unavailable</span>
            <button type="button" class="add_new_time" data-day-name="${dayNumber}">
                <img src="/images/plus-icon.svg" alt="">
            </button>
        </div>
    `;
}

function handleFiles(files, fileIndex, newFilesIndex) {
    const newFiles = Array.from(files); // Convert FileList to an array

    newFiles.forEach((file, index) => {
        if (file.type.startsWith('image/')) {
            if (fileIndex !== undefined && fileIndex !== null) {
                // Replace existing file
                filesArray[fileIndex] = file;
                const reader = new FileReader();
                reader.onload = function (e) {
                    $(`#uploaded-img-item-${fileIndex}`).find('img').attr("src", e.target.result);
                    $(`#uploaded-img-item-${fileIndex}`).find(".replace-image").attr("data-img-name", file.name).data("img-name", file.name);
                    $(`#uploaded-img-item-${fileIndex}`).find(".remove-image").attr("data-img-name", file.name).data("img-name", file.name);
                };
                reader.readAsDataURL(file);
            } else {
                // Add new images
                const fileIndex = filesArray.length;
                filesArray.push(file);
                const reader = new FileReader();
                reader.onload = function (e) {
                    const uploadedImgPreviewDiv = `
                        <div id="uploaded-img-item-${fileIndex}" class="uploaded-img-item" draggable="true">
                            <div class="image-action">
                                <input type="file" hidden class="w-100 replaceFileInput" name="images[]" accept="image/*">
                                <button class="replace-image" data-index="${fileIndex}" data-img-name="${file.name}">Replace</button>
                                <button class="remove-image" data-index="${fileIndex}" data-img-name="${file.name}">Remove</button>
                            </div>
                            <img src="${e.target.result}" alt="">
                        </div>
                    `;
                    uploadedImgPreview.append(uploadedImgPreviewDiv);
                    updateDataIndexes(); // Ensure indexes stay updated
                };
                reader.readAsDataURL(file);
            }
        } else {
            showToast(0, 'Please select an image file');
        }
    });

    fileInput.val(null); // Reset input after processing all files
}

function updateDataIndexes() {
    uploadedImgPreview.children().each(function (index) {
        $(this).attr('id', `uploaded-img-item-${index}`);
        $(this).find('.replace-image').attr('data-index', index);
        $(this).find('.remove-image').attr('data-index', index);
    });
}

// Update itinerary step numbers
function updateItineraryNumbers() {
    $(".itinerary_div .iti-form").each(function (index) {
        $(this).find(".iti-item-no").text(index + 1);
    });
}
