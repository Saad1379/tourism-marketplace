var inclusionCount = 1;
var exclusionCount = 1;
var itineraryCount = 1;

var filesArray = [];

$(document).ready(function () {
    $("#p_loader").addClass("d-none");

    $("#offer_is_live").prop("checked", false);
    $("#is_child_val_switch").prop("checked", false);
    $("#is_infant_val_switch").prop("checked", false);
    $("#is_youth_val_switch").prop("checked", false);

    $("#discounted_amount").prop("readonly", true);
    $("#child_amount").prop("readonly", true);
    $("#infant_amount").prop("readonly", true);
    $("#youth_amount").prop("readonly", true);

    $("#discounted_amount").val("");
    $("#child_amount").val("");
    $("#infant_amount").val("");
    $("#youth_amount").val("");

    $("#discount_red_dot_view").addClass("d-none");
    $("#discount_input").addClass("disabled btn-disabled");
    $("#child_red_dot_view").addClass("d-none");
    $("#child_input").addClass("disabled btn-disabled");
    $("#infant_red_dot_view").addClass("d-none");
    $("#infant_input").addClass("disabled btn-disabled");
    $("#youth_red_dot_view").addClass("d-none");
    $("#youth_input").addClass("disabled btn-disabled");
    $(".remove_time_slot_1").hide();
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

// Text Limit Set
$(".text_input_limit").on("input", function (event) {
    const maxLength = $(this).data("text-limit");
    const currentValue = $(this).val();
    if (currentValue.length > maxLength) {
        $(this).val(currentValue.substring(0, maxLength));
    };
});

// Number format Set
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
    }
});

$("#offer_is_live").on("change", function (e) {
    $("#discounted_amount").val("");
    if ($(this).is(":checked")) {
        $("#discounted_amount").prop("readonly", false);
        $("#discount_red_dot_view").removeClass("d-none");
        $("#discount_input").removeClass("disabled btn-disabled");
    } else {
        $("#discounted_amount").prop("readonly", true);
        $("#discount_red_dot_view").addClass("d-none");
        $("#discount_input").addClass("disabled btn-disabled");
    };
});

$("#is_child_val_switch").on("change", function (e) {
    $("#child_amount").val("");
    if ($(this).is(":checked")) {
        $("#child_amount").prop("readonly", false);
        $("#child_red_dot_view").removeClass("d-none");
        $("#child_input").removeClass("disabled btn-disabled");
    } else {
        $("#child_amount").prop("readonly", true);
        $("#child_red_dot_view").addClass("d-none");
        $("#child_input").addClass("disabled btn-disabled");
    };
});

$("#is_infant_val_switch").on("change", function (e) {
    $("#infant_amount").val("");
    if ($(this).is(":checked")) {
        $("#infant_amount").prop("readonly", false);
        $("#infant_red_dot_view").removeClass("d-none");
        $("#infant_input").removeClass("disabled btn-disabled");
    } else {
        $("#infant_amount").prop("readonly", true);
        $("#infant_red_dot_view").addClass("d-none");
        $("#infant_input").addClass("disabled btn-disabled");
    };
});

$("#is_youth_val_switch").on("change", function (e) {
    $("#youth_amount").val("");
    if ($(this).is(":checked")) {
        $("#youth_amount").prop("readonly", false);
        $("#youth_red_dot_view").removeClass("d-none");
        $("#youth_input").removeClass("disabled btn-disabled");
    } else {
        $("#youth_amount").prop("readonly", true);
        $("#youth_red_dot_view").addClass("d-none");
        $("#youth_input").addClass("disabled btn-disabled");
    };
});

// **************** Start Image Upload and Drag && Drop ***************** //

$('#fileInput').on('change', function (event) {
    handleFiles(event.target.files);
});

$('#imgUploadBtn').on('dragover', function (e) {
    e.preventDefault();
});

$('#imgUploadBtn').on('drop', function (e) {
    e.preventDefault();
    const files = e.originalEvent.dataTransfer.files
    handleFiles(files);
});

$(document).on("click", ".replace-image", function (e) {
    e.preventDefault();
    const fileInput = $("#fileInput");
    const fileIndex = $(this).data("index");
    fileInput.off("change").on("change", function (e) {
        handleFiles(e.target.files, fileIndex);

        fileInput.off("change").on("change", function (e) {
            handleFiles(e.target.files);
        });
    });

    fileInput.click();
    fileInput.val("");
});

$(document).on("click", ".remove-image", function (e) {
    e.preventDefault();
    const fileIndex = $(this).data("index");

    filesArray.splice(fileIndex, 1);
    $(this).closest(".uploaded-img-item").remove();
    $("#uploaded-img-preview .uploaded-img-item").each(function (i) {
        $(this).attr("id", `uploaded-img-item-${i}`);
        $(this).find(".replace-image").attr("data-index", i);
        $(this).find(".remove-image").attr("data-index", i);
    });
    $("#fileInput").val("");
});

// **************** End ***************** //

// Add Meeting Point Html
$(document).on("click", "#add_new_meeting_point", function (e) {
    newMeetingPointHtml();
});

function newMeetingPointHtml(name = '', lat = '', long = '') {
    const meetingNameHtml = `<div class="col-12"><div class="mb-0"><div class="d-flex align-items-center justify-content-between"><label for="meetingPointName" class="form-label">Enter Meeting Point Name</label> <button class="remove-btn remove_meeting_point_btn"></button></div><input type="text" class="form-control" name="mettingPointName" data-text-limit="50" placeholder="Enter meeting point name" value="${name}" /></div></div>`;
    const meetingLatitude = `<div class="col-12 col-lg-6"><div class="mb-0"><label for="latitude" class="form-label">Latitude</label><input type="text" class="form-control" name="latitude" placeholder="Enter Latitude" value="${lat}" /></div></div>`;
    const meetingLongitude = `<div class="col-12 col-lg-6"><div class="mb-0"><label for="longitude" class="form-label">Longitude</label><input type="text" class="form-control" name="longitude" placeholder="Enter Longitude" value="${long}" /></div></div>`;

    let addMeetingHtml = "<div class='row gy-3 gx-2 meeting_point_block'>";
    addMeetingHtml += "<span class='meeting_space'></span>";
    addMeetingHtml += meetingNameHtml;
    addMeetingHtml += meetingLatitude;
    addMeetingHtml += meetingLongitude;
    addMeetingHtml += "</div>";
    $(".meeting_point_div").append(addMeetingHtml);
}

$(document).on("click", ".remove_meeting_point_btn", function (e) {
    e.preventDefault();
    $(this).closest('.meeting_point_block').remove();
});

// Add Package Inclusion Html
$(document).on("click", "#add_new_package_inclusion", function (e) {
    newInclusionHtml();
    updateInclusionLabels();
});

function newInclusionHtml(value = '') {
    inclusionCount++;

    let addPackageInclusionHtml = `
        <div class="col-12 package_inclusion_block" style="margin-top: 10px;">
            <div class="mb-0 package-inclusion">
                <div class="d-flex align-items-center justify-content-between">
                    <label for="inclusion" class="form-label inclusion-label">Inclusion ${inclusionCount}</label>
                    <button class="remove-btn remove_package_inclusion_btn"></button>
                </div>
                <input type="text" class="form-control" name="packageInclusion" placeholder="Enter detail here" value="${value}" />
            </div>
        </div>`;

    $(".package_inclusion_add_div").append(addPackageInclusionHtml);
}

$(document).on("click", ".remove_package_inclusion_btn", function (e) {
    e.preventDefault();
    $(this).closest('.package_inclusion_block').remove();
    updateInclusionLabels();
});

// Add Package Exclusion Html
$(document).on("click", "#add_new_package_exclusion", function (e) {
    newExclusionHtml();
    updateExclusionLabels();
});

function newExclusionHtml(value = '') {
    exclusionCount++;

    let addPackageInclusionHtml = `
        <div class="col-12 package_exclusion_block" style="margin-top: 10px;">
            <div class="mb-0 package-exclusion">
                <div class="d-flex align-items-center justify-content-between">
                    <label for="exclusion" class="form-label exclusion-label">Exclusion ${exclusionCount}</label>
                    <button class="remove-btn remove_package_exclusion_btn"></button>
                </div>
                <input type="text" class="form-control" name="packageExclusion" placeholder="Enter detail here" value="${value}" />
            </div>
        </div>`;

    $(".package_exclusion_add_div").append(addPackageInclusionHtml);
}

$(document).on("click", ".remove_package_exclusion_btn", function (e) {
    e.preventDefault();
    $(this).closest('.package_exclusion_block').remove();
    updateExclusionLabels();
});

// Add Itinerary Html
$(document).on("click", "#add_new_itinerary", function (e) {
    itineraryHtml();
    updateItineraryLabels();
});

function itineraryHtml(title = '', description = '') {
    itineraryCount++;
    let itineraryHtml = "<div class='itinerary_block'>";
    itineraryHtml += `<span class='itinerary_space'></span>
        <div class="row gy-3 gx-2 iti-form">
            <div class="iti-item-no itinerary-label">${itineraryCount}</div>
            <div class="col-12 col-lg-6">
                <div class="mb-0">
                    <label for="itineraryName" class="form-label">Itinerary</label>
                    <input type="text" val="${title}" name="itineraryName" class="form-control" placeholder="Enter Title" />
                </div>
            </div>
            <div class="col-12 col-lg-6">
                <div class="mb-0">
                    <div class="d-flex align-items-center justify-content-between">
                        <label for="itineraryTime" class="form-label">Time </label>
                        <button class="remove-btn remove_itinerary_btn"></button>
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
                    <label for="itineraryDescription" class="form-label">Details</label>
                    <textarea class="form-control itinerary_description" rows="5" name="itineraryDescription" placeholder="Enter Details">${description}</textarea>
                </div>
            </div>
        </div>
    `;

    $(".itinerary_div").append(itineraryHtml);


}

$(document).on("click", ".remove_itinerary_btn", function (e) {
    e.preventDefault();
    $(this).closest('.itinerary_block').remove();
    updateItineraryLabels();
});

$(document).on("click", ".add_new_time", function () {
    let dayNumber = $(this).data("day-name");
    let container = getContainerByDayNumber(dayNumber);
    let currentSlots = container.find('.time-inp').length;

    if (container.find(".text-center.mx-auto").length) {
        container.removeClass("w-100");
        container.empty();
    }

    let newIndex = currentSlots + 1;
    let newSlot = getTimeSlotHTML(dayNumber, newIndex);
    container.append(newSlot);

    container.find('input[name="startTime"], input[name="endTime"], input[name="cutOffTime"]').each(function () {
        flatpickr(this, {
            enableTime: true,
            noCalendar: true,
            dateFormat: "h:i K", // 12-hour format with AM/PM
            time_24hr: false,
            minuteIncrement: 1,
            wrap: false
        });
    });

    container.find(`.add_time_slot_${currentSlots}`).hide();
});


$(document).on("click", ".remove_time", function () {
    let dayNumber = $(this).data("day-name");
    let container = getContainerByDayNumber(dayNumber);
    let currentSlots = container.find('.time-inp').length;

    $(this).closest(".time-inp").remove();

    if (container.find(".time-inp").length === 0) {
        container.addClass("w-100");
        container.html(getUnavailableHTML(dayNumber));
    } else {
        container.find(`.add_time_slot_${currentSlots - 1}`).show();
    }

    container.find('.time-inp').each(function (index) {
        let slotIndex = index + 1;
        $(this).find('.add_new_time').attr('data-slot-index', slotIndex);
        $(this).find('.remove_time').attr('data-slot-index', slotIndex);
        $(this).find('.add_new_time').attr('class', `add_new_time add_time_slot_${slotIndex}`);
        $(this).find('.remove_time').attr('class', `remove_time remove_time_slot_${slotIndex}`);
    });
});

$.get("https://countriesnow.space/api/v0.1/countries", function (data) {
    const countries = data.data;
    $.each(countries, function (i, country) {
        $('#country').append(`<option value="${country.country}" data-iso2="${country.iso2}" data-iso3="${country.iso3}">${country.country}</option>`);
    });
});

// When country is selected
$('#country').on('change', function () {
    let selectedCountry = $(this).val();
    fetchStatesByCountry(selectedCountry);
});

function fetchStatesByCountry(country) {
    $('#state').prop('disabled', true);
    $('#city').prop('disabled', true);
    $('#state').html('<option value="">Loading...</option>');
    $('#city').html('<option value="">Select City</option>');
    return new Promise((resolve) => {
        $.ajax({
            url: "https://countriesnow.space/api/v0.1/countries/states",
            method: "POST",
            data: JSON.stringify({ country: country }),
            contentType: "application/json",
            success: function (response) {
                $('#state').html('<option value="">Select State</option>');
                $.each(response.data.states, function (i, state) {
                    $('#state').append(`<option value="${state.name}">${state.name}</option>`);
                });
                $('#state').prop('disabled', false);
                resolve(true);
            },
            error: function () {
                $('#state').html('<option value="">Failed to load states</option>');
                $('#state').prop('disabled', false);
                resolve(false);
            }
        });
    });
}

// When state is selected
$('#state').on('change', function () {
    let selectedCountry = $('#country').val();
    let selectedState = $(this).val();

    fetchCitiesByState(selectedCountry, selectedState);
});

function fetchCitiesByState(country, state) {
    $('#city').prop('disabled', true);
    $('#city').html('<option value="">Loading...</option>');

    return new Promise((resolve) => {
        $.ajax({
            url: "https://countriesnow.space/api/v0.1/countries/state/cities",
            method: "POST",
            data: JSON.stringify({ country: country, state: state }),
            contentType: "application/json",
            success: function (response) {
                $('#city').html('<option value="">Select City</option>');
                $.each(response.data, function (i, city) {
                    $('#city').append(`<option value="${city}">${city}</option>`);
                });
                $('#city').prop('disabled', false);
                resolve(true);
            },
            error: function () {
                $('#city').html('<option value="">Failed to load cities</option>');
                $('#city').prop('disabled', false);
                resolve(false);
            }
        });
    });
}

const selectedInput = document.getElementById('audio_guide_select');
const optionsContainer = document.getElementById('optionsContainer');

const languageMap = {
    '1': 'English',
    '2': 'French',
    '3': 'Spanish'
};

const languageIso = {
    "en": "1",
    "fr": "2",
    "es": "3",
}

const checkboxes = optionsContainer.querySelectorAll('input[type="checkbox"]');

selectedInput.addEventListener('click', () => {
    optionsContainer.style.display = optionsContainer.style.display === 'block' ? 'none' : 'block';
});

checkboxes.forEach(checkbox => {
    checkbox.addEventListener('change', () => {
        const selected = Array.from(checkboxes).filter(cb => cb.checked).map(cb => languageMap[cb.value]);

        selectedInput.value = selected.join(', ');
    });
});

document.addEventListener('click', (e) => {
    if (!e.target.closest('.multi-select')) {
        optionsContainer.style.display = 'none';
    }
});

// Add Activity API Call
$("#add_activity_details").on("click", function (e) {
    $("#p_loader").removeClass("d-none");

    e.preventDefault();
    if (!validationActivityForm()) {
        $("#p_loader").addClass("d-none");
        return;
    };

    const formData = new FormData();

    const files = document.getElementById('fileInput').files;
    const activity_name = $("#activity_name").val();
    const activity_duration = $("#activity_duration").val();
    const total_activity_format_value = $("#total_activity_value").val();
    const total_activity_value = parseFloat(total_activity_format_value.replace(/,/g, ''));
    const discounted_amount_format_value = $("#discounted_amount").val();
    const discounted_amount = discounted_amount_format_value ? parseFloat(discounted_amount_format_value.replace(/,/g, '')) : 0;
    const child_amount_format_value = $("#child_amount").val();
    const child_amount = child_amount_format_value ? parseFloat(child_amount_format_value.replace(/,/g, '')) : 0;
    const infant_amount_format_value = $("#infant_amount").val();
    const infant_amount = infant_amount_format_value ? parseFloat(infant_amount_format_value.replace(/,/g, '')) : 0;
    const youth_amount_format_value = $("#youth_amount").val();
    const youth_amount = youth_amount_format_value ? parseFloat(youth_amount_format_value.replace(/,/g, '')) : 0;
    const audio_guide_select = Array.from(checkboxes).filter(cb => cb.checked).map(cb => languageMap[cb.value]);

    const description = $("#description").val();
    const ticket_policy = $("#ticket_policy").val();
    const refund_policy = $("#refund_policy").val();
    const country = $("#country").val();
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

    if (audio_guide_select.length === 0) {
        $("#p_loader").addClass("d-none");
        showToast(0, "Please select an audio guide language.");
        return;
    }

    // Upload multiple images
    for (let i = 0; i < filesArray.length; i++) {
        formData.append('images[]', filesArray[i]);
    }

    // Meeting Points
    const meetingPoints = Array.from(document.querySelectorAll('.meeting_point_div, .meeting_point_block')).map(mp => ({
        mettingPointName: mp.querySelector('input[name="mettingPointName"]')?.value || '',
        latitude: mp.querySelector('input[name="latitude"]')?.value || '',
        longitude: mp.querySelector('input[name="longitude"]')?.value || ''
    })).filter(mp => mp.mettingPointName && mp.latitude && mp.longitude);

    // Package Inclusions
    const packageInclusion = Array.from(document.querySelectorAll('.package_inclusion_div input[name="packageInclusion"]')).map(input => input.value).filter(Boolean);

    // Package Exclusions
    const packageExclusion = Array.from(document.querySelectorAll('.package_exclusion_div input[name="packageExclusion"]')).map(input => input.value).filter(Boolean);

    // Itinerary
    const itinerary = Array.from(document.querySelectorAll('.iti-form')).map(item => ({
        itineraryName: item.querySelector('input[name="itineraryName"]')?.value || '',
        time: item.querySelector('select[name="itineraryTime"]')?.value || '',
        details: item.querySelector('textarea[name="itineraryDescription"]')?.value || ''
    })).filter(item => item.itineraryName && item.time && item.details);

    let hasTimeError = false;

    const operatingHours = Array.from(document.querySelectorAll(".days")).map((dayEl) => {
        const isSelected = dayEl.querySelector('input[name="isDaySelected"]').checked;
        const day = dayEl.querySelector('input[name="isDayName"]').value;
        const dateTime = Array.from(dayEl.querySelectorAll(".hours_time_slot .time-inp")).map((slot) => {
            const start_time_val = slot.querySelector('input[name="startTime"]')?.value.trim() || '';
            const end_time_val = slot.querySelector('input[name="endTime"]')?.value.trim() || '';
            const cut_off_time_val = slot.querySelector('input[name="cutOffTime"]')?.value.trim() || '';

            const startTime = formatTimeTo12HourWithLeadingZero(start_time_val);
            const endTime = formatTimeTo12HourWithLeadingZero(end_time_val);
            const cutOffTime = cut_off_time_val ? formatTimeTo12HourWithLeadingZero(cut_off_time_val) : "";

            return { startTime, endTime, cutOffTime };
        });
        return { isSelected, day, dateTime };
    });

    const anyDaySelected = operatingHours.some(day => day.isSelected);
    if (!anyDaySelected) {
        $("#p_loader").addClass("d-none");
        showToast(0, "Please select at least one operating day.");
        return;
    }

    operatingHours.forEach((dayObj, i) => {
        const { isSelected, day, dateTime } = dayObj;
        const isDayName = day === 'Monday' || day === 'Tuesday' || day === 'Wednesday' || day === 'Thursday' || day === 'Friday' || day === 'Saturday' || day === 'Sunday';
        if (isSelected) {
            dateTime.forEach((slot, j) => {
                const { startTime, endTime, cutOffTime } = slot;
                if (isDayName && j === 0) {
                    if (!startTime || !endTime || !cutOffTime) {
                        $("#p_loader").addClass("d-none");
                        showToast(0, `Please fill all time fields for ${day}, slot ${j + 1}`);
                        hasTimeError = true;
                        return;
                    }
                } else if (isDayName && (j !== 0)) {
                    if (!startTime || !endTime) {
                        $("#p_loader").addClass("d-none");
                        showToast(0, `Please fill  start time and end time fields for ${day}, slot ${j + 1}`);
                        hasTimeError = true;
                        return;
                    }
                }
            });
        }
    });

    if (hasTimeError) {
        return;
    }

    formData.append('activityName', activity_name);
    formData.append('activityDuration', activity_duration);
    formData.append('totalValue', total_activity_value);
    formData.append('discountValue', offer_is_live ? discounted_amount : 0);
    formData.append('isOfferLive', offer_is_live);
    formData.append('isChildInclude', is_child_val_switch);
    formData.append('childValue', is_child_val_switch ? child_amount : 0);
    formData.append('isInfantInclude', is_infant_val_switch);
    formData.append('infantValue', is_infant_val_switch ? infant_amount : 0);
    formData.append('isYouthInclude', is_youth_val_switch);
    formData.append('youthValue', is_youth_val_switch ? youth_amount : 0);
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
    formData.append('meetingEndLatitude', meetingEndLatitude);

    $(this).addClass("btn-disabled");

    postFileCall("/add-activity", formData, function (response) {
        if (response.flag === 1) {
            setTimeout(() => {
                $("#p_loader").addClass("d-none");
            }, 800);
            setTimeout(() => {
                $("#addActivityModel").modal("show");
            }, 1200);
        } else {
            $("#p_loader").addClass("d-none");
            showToast(response.flag, response.msg);
            $("#add_activity_details").removeClass("btn-disabled");
        };
    });
});

$('#go-dashboard').on('click', function () {
    window.location.href = '/dashboard';
});

$('#view-activity').on('click', function () {
    window.location.href = '/activity';
});

// File Upload Function
function handleFiles(files, fileIndex) {
    $.each(files, function (index, file) {
        if (!file.type.startsWith('image/')) {
            showToast(0, 'Please select an image file');
            return;
        }
        const reader = new FileReader();
        reader.onload = function (e) {
            console.log("File -> ", file)
            if (fileIndex !== undefined) {
                filesArray[fileIndex] = file;
                $(`#uploaded-img-item-${fileIndex}`).find("img").attr("src", e.target.result);
            } else {
                const currentIndex = filesArray.length;
                filesArray.push(file);

                const uploadedImgPreviewDiv = `
                    <div id="uploaded-img-item-${currentIndex}" class="uploaded-img-item">
                        <div class="image-action">
                            <button class="replace-image" data-index=${currentIndex}>Replace</button>
                            <button class="remove-image" data-index=${currentIndex}>Remove</button>
                        </div>
                        <img src="${e.target.result}" alt="">
                    </div>`;
                $('#uploaded-img-preview').append(uploadedImgPreviewDiv);
            }
        };
        reader.readAsDataURL(file);
    });
}

function getContainerByDayNumber(dayNumber) {
    switch (dayNumber) {
        case 1: return $('.monday_hours_html_div');
        case 2: return $('.tuesday_hours_html_div');
        case 3: return $('.wednesday_hours_html_div');
        case 4: return $('.thursday_hours_html_div');
        case 5: return $('.friday_hours_html_div');
        case 6: return $('.saturday_hours_html_div');
        case 7: return $('.sunday_hours_html_div');
        default: return $(); // Empty jQuery object
    }
}

function getTimeSlotHTML(dayNumber, index) {
    return `
        <div class="d-flex align-items-center time-inp gap-2" style="margin-top: 10px;">
            <input type="text" class="time-picker flatpickr-input" name="startTime" placeholder="Time">
            -
            <input type="text" class="time-picker flatpickr-input" name="endTime" placeholder="Time">
            <span class="action-btn-group d-flex align-items-center ms-2 gap-2">
                <button type="button" class="add_new_time add_time_slot_${index}" data-day-name="${dayNumber}" data-slot-index="${index}">
                    <img src="/images/plus-icon.svg" alt="">
                </button>
                <button type="button" class="remove_time remove_time_slot_${index}" data-day-name="${dayNumber}" data-slot-index="${index}">
                    <img src="/images/close-icon.svg" alt="">
                </button>
            </span>
        </div>
    `;
}

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


function validationActivityForm() {
    const files = document.getElementById('fileInput').files;
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
    const description = $("#description").val();
    const ticket_policy = $("#ticket_policy").val();
    const refund_policy = $("#refund_policy").val();

    const meeting_point_name = $("#meeting_point_name").val();
    const meeting_latitude = $("#meeting_latitude").val();
    const meeting_longitude = $("#meeting_longitude").val();

    const meeting_end_point_name = $("#meeting_end_point_name").val();
    const meeting_end_latitude = $("#meeting_end_latitude").val();
    const meeting_end_longitude = $("#meeting_end_longitude").val();

    const itinerary_name = $("#itinerary_name").val();
    const itinerary_time = $("#itinerary_time").val();
    const itinerary_description = $("#itinerary_description").val();

    const package_inclusion_1 = $("#package_inclusion_1").val();
    const package_exclusion_1 = $("#package_exclusion_1").val();

    const offer_is_live = $("#offer_is_live").is(":checked");
    const is_child_val_switch = $("#is_child_val_switch").is(":checked");
    const is_infant_val_switch = $("#is_infant_val_switch").is(":checked");
    const is_youth_val_switch = $("#is_youth_val_switch").is(":checked");
    const country = $("#country").val();
    const city = $("#city").val();
    const state = $("#state").val();

    if (!activity_name) {
        showToast(0, "Please enter activity name");
        return false;
    };

    if (activity_name?.length < 3) {
        showToast(0, "Activity name must be atleast 3 characters");
        return false;
    };

    // if (activity_name?.length > 50) {
    //     showToast(0, "The Activity Name field should not be more than 50 characters");
    //     return false;
    // };

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

    if (!country) {
        showToast(0, "Please enter country name");
        return false;
    };
    if (!state) {
        showToast(0, "Please enter state name");
        return false;
    };

    if (!meeting_point_name) {
        showToast(0, "Please enter meeting point name.");
        return false;
    };

    if (!meeting_latitude) {
        showToast(0, "Please enter meeting latitude.");
        return false;
    };

    if (!meeting_longitude) {
        showToast(0, "Please enter meeting longitude.");
        return false;
    };

    if (!meeting_end_point_name) {
        showToast(0, "Please Enter End Point Name.");
        return false;
    };

    if (!meeting_end_latitude) {
        showToast(0, "Please enter meeting end point latitude.");
        return false;
    };

    if (!meeting_end_longitude) {
        showToast(0, "Please enter meeting end point longitude.");
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

    if (!package_inclusion_1) {
        showToast(0, "Please enter package inclusion.");
        return false;
    };

    if (!package_exclusion_1) {
        showToast(0, "Please enter package exclusion.");
        return false;
    };

    if (!itinerary_name) {
        showToast(0, "Please enter itinerary details.");
        return false;
    };

    if (!itinerary_time) {
        showToast(0, "Please select itinerary time.");
        return false;
    };

    if (!itinerary_description) {
        showToast(0, "Please enter itinerary description.");
        return false;
    };

    if (filesArray.length < 5) {
        showToast(0, "Please select minimum 5 images upload");
        return false;
    }


    return true;
};

function updateInclusionLabels() {
    $(".package_inclusion_block").each(function (index) {
        $(this).find(".inclusion-label").text("Inclusion " + (index + 2));
    });
};

function updateExclusionLabels() {
    $(".package_exclusion_block").each(function (index) {
        $(this).find(".exclusion-label").text("Exclusion " + (index + 2));
    });
};

function updateItineraryLabels() {
    $(".itinerary_block").each(function (index) {
        $(this).find(".itinerary-label").text(index + 2);
    });
};

function bindGlobalFileInput() {
    $('#fileInput').off('change').on('change', function (event) {
        handleFiles(event.target.files);
    });
};

function resetForm() {
    $('#add_activity_form')[0].reset();
    filesArray = [];
    $('#uploaded-img-preview').empty();
    $(".meeting_point_block").remove();
    $('#meeting_point_name').val('');
    $('#meeting_latitude').val('');
    $('#meeting_longitude').val('');

    $('.itinerary_block').remove();
    $('#itinerary_name').val('');
    $('#itinerary_description').val('');
}


$(document).on("click", "#fetch_activity_details", function () {
    const bokunId = $("#bokun_id").val().trim();
    if (!bokunId) {
        showToast(0, "Please enter Bokun ID");
        return;
    }
    $("#p_loader").removeClass("d-none");
    postAjaxCall("/bokun/activity/fetch", { bokun_id: bokunId }, async function (response) {
        $("#p_loader").addClass("d-none");
        if (response.flag != 1) {
            showToast(response.flag, response.msg);
            return;
        }
        $('#add_activity_form')[0].reset();
        const activityData = response.data;
        $('#activity_name').val(activityData.title)
        $('#description').val(replaceBrTags(activityData.description))

        let duration = '0M';
        if (activityData.duration) {
            if (activityData.duration['days']) {
                duration = activityData.duration['days'] + 'D';
            }
            if (activityData.duration['hours']) {
                duration = activityData.duration['hours'] + 'H';
            }
            if (activityData.duration['minutes']) {
                duration = activityData.duration['minutes'] + 'M';
            }
            if (activityData.duration['weeks']) {
                duration = activityData.duration['weeks'] + 'W';
            }
        }

        console.log('duration---------->', duration, $('#activity_duration option[data-time="1H"]'));

        // select option where data-time=duration
        $('#activity_duration option[data-time="' + duration + '"]').prop('selected', true).trigger('change');

        if (activityData.activityPrice && activityData.activityPrice['CHILD']) {
            $('#is_child_val_switch').prop('checked', true).trigger('change');
            $('#child_amount').val(activityData.activityPrice['CHILD']);
        }
        if (activityData.activityPrice && activityData.activityPrice['INFANT']) {
            $('#is_infant_val_switch').prop('checked', true).trigger('change');
            $('#infant_amount').val(activityData.activityPrice['INFANT']);
        }
        if (activityData.activityPrice && activityData.activityPrice['YOUTH']) {
            $('#is_youth_val_switch').prop('checked', true).trigger('change');
            $('#youth_amount').val(activityData.activityPrice['YOUTH']);
        }

        if (activityData.guidanceTypes && activityData.guidanceTypes.GUIDED && activityData.guidanceTypes.GUIDED.length > 0) {


            let languageSupported = [];
            activityData.guidanceTypes.GUIDED.forEach(type => {
                if (languageIso[type]) {
                    console.log('type---------->', languageIso[type]);
                    languageSupported.push(languageIso[type]);
                }
            });


            const guidanceTypes = languageSupported.map(type => languageMap[type]).join(', ');
            $('#audio_guide_select').val(guidanceTypes);
            languageSupported.forEach(lang => {
                const checkBox = $('.audio-checkbox[value="' + lang + '"]');
                if (checkBox.length) {
                    checkBox.prop('checked', true);
                }
            });
        }

        let countryName = ''
        $('#country option').each(function () {
            if ($(this).data('iso2') === activityData.location.countryCode) {
                countryName = $(this).val();
            }
        });

        $('#country').val(countryName);
        const isStateSet = await fetchStatesByCountry(countryName)
        if (isStateSet) {
            $('#state').val(activityData.location.state);
        }
        const isCitySet = await fetchCitiesByState(countryName, activityData.location.state);
        if (isCitySet) {
            $('#city').val(activityData.location.city);
        }

        const meetingPointData = activityData.meetingType.meetingPointAddresses;
        $(".meeting_point_block").remove();
        $('#meeting_point_name').val('');
        $('#meeting_latitude').val('');
        $('#meeting_longitude').val('');
        if (meetingPointData && meetingPointData.length > 0) {
            $('#meeting_point_name').val(meetingPointData[0].title);
            $('#meeting_latitude').val(meetingPointData[0].address.latitude);
            $('#meeting_longitude').val(meetingPointData[0].address.longitude);
            if (meetingPointData.length > 1) {
                meetingPointData.forEach(function (point, idx) {
                    if (idx !== 0) {
                        newMeetingPointHtml(point.title, point.address.latitude, point.address.longitude);
                    }
                });
            }
        }

        // Split string to array by <br> tag
        const includedItems = activityData.included.split('<br />')
        if (includedItems.length > 0) {
            $('#package_inclusion_1').val(includedItems[0].trim());
            includedItems.forEach(function (item, index) {
                if (index === 0) return; // Skip the first item as it's already set
                if (item.trim() !== '') {
                    newInclusionHtml(item.trim());
                }
            });
        } else {
            $('#package_inclusion_1').val(activityData.included);
        }
        
        const excludedItems = activityData.excluded.split('<br />')
        if (excludedItems.length > 0) {
            $('#package_exclusion_1').val(excludedItems[0].trim());
            excludedItems.forEach(function (item, index) {
                if (index === 0) return; // Skip the first item as it's already set
                if (item.trim() !== '') {
                    newExclusionHtml(item.trim());
                }
            });
        } else {
            $('#package_exclusion_1').val(activityData.excluded);
        }

        $('.itinerary_block').remove();
        $('#itinerary_name').val('');
        $('#itinerary_description').val('');
        if (activityData.itinerary && activityData.itinerary.length > 0) {
            $('#itinerary_name').val(activityData.itinerary[0].title);
            $('#itinerary_description').val(activityData.itinerary[0].description);
            if (activityData.itinerary.length > 1) {
                activityData.itinerary.forEach(function (item, idx) {
                    if (idx !== 0) {
                        itineraryHtml(item.title, item.description);
                    }
                });
            }
        }
        updateItineraryLabels();
        filesArray = [];
        $('#uploaded-img-preview').empty();
        if (activityData.photos && activityData.photos.length > 0) {
            activityData.photos.forEach(function (photo) {
                readImageAsFile(photo.url).then(function (file) {
                    handleFiles([file]);
                });
            });
        }

    });
});

// Read data of given image url and return file object
function readImageAsFile(imageUrl, fileName) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous'; // Handle CORS if needed
        img.onload = function () {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            canvas.toBlob(function (blob) {
                const randomName = Math.floor(100000 + Math.random() * 900000).toString();
                const file = new File([blob], randomName + ".jpg", { type: 'image/jpeg' });
                resolve(file);
            }, 'image/jpeg');
        };
        img.onerror = function (error) {
            reject(error);
        };
        img.src = imageUrl;
    });
}
