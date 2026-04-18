let bookingFilter = 1;
const filesArray = [];
$(document).ready(function() {
    $("#p_loader").addClass("d-none");
    setBookingList();
});

$(document).on("click", ".upcoming_booking", function() {
    $(".booking_list").removeAttr("id");
    $(".booking_list").attr("id", "content1");

    bookingFilter = 1;
    setBookingList();
});

$(document).on("click", ".complete_booking", function() {
    $(".booking_list").removeAttr("id");
    $(".booking_list").attr("id", "content2");

    bookingFilter = 2;
    setBookingList();
});

$(document).on("click", ".cancelled_booking", function() {
    $(".booking_list").removeAttr("id");
    $(".booking_list").attr("id", "content3");

    bookingFilter = 3;
    setBookingList();
});

$(document).on("click", "#cancel_trip_modal_btn", function() {
    let bookingId = $(this).data("booking-id");
    $("#cancelTicket #description_text").val("");
    $("#cancelTicket #reason_select").val("");
    $("#cancel_trip_request_btn").data("booking-id", bookingId);
});

$(document).on("click", "#cancel_trip_request_btn", function() {
    $("#p_loader").removeClass("d-none");

    const reason = $("#cancelTicket #reason_select").val() || "";
    const description = $("#cancelTicket #description_text").val();
    let bookingId = $(this).data("booking-id");

    if(!reason){
        $("#p_loader").addClass("d-none");
        showToast(0, "Please select reason.");
        return;
    };

    let payload = {
        bookingId: bookingId,
        reason: reason,
        description: description,
    };

    $(this).addClass("btn-disabled");

    postAjaxCall("/cancel-trip-ticket", payload, function (response) {
        setTimeout(() => {
            $("#p_loader").addClass("d-none");
        }, 800);
        if (response.flag === 1) {
            setTimeout(() => {
                showToast(response.flag, response.msg);
            }, 1200);
            setTimeout(() => {
                location.reload(1);
            }, 2000);
        } else {
            $("#p_loader").addClass("d-none");
            showOwnToast(response.flag, response.msg);
            $("#cancel_trip_request_btn").removeClass("btn-disabled");
        };
    });
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

// **************** Start Image Upload and Drag && Drop ***************** //
$("#fileRatingInput").on('change', function(event) {
    handleRatingFiles(event.target.files);
});

$('#imgUploadBtn').on('dragover', function(e) {
    e.preventDefault();
});

$('#imgUploadBtn').on('drop', function(e) {
    e.preventDefault();
    const files = e.originalEvent.dataTransfer.files
    handleRatingFiles(files);
});

document.addEventListener("DOMContentLoaded", () => {
    const imgUploadBtn = document.getElementById("imgUploadBtn");
    const fileRatingId = document.getElementById("fileRatingInput");

    imgUploadBtn.addEventListener("click", () => {
        fileRatingId.click();
    });
});

$(document).on("click", ".replace-image", function(e) {
    e.preventDefault();
    const fileRatingId = $("#fileRatingInput");
    fileRatingId.click();
    const fileIndex = $(this).data("index");

    fileRatingId.off("change").on("change", function(e) {
        handleRatingFiles(e.target.files, fileIndex);
    });
});

$(document).on("click", ".remove-image", function(e) {
    e.preventDefault();
    const fileIndex = $(this).data("index");
    filesArray.splice(fileIndex, 1);
    $(this).closest(".uploaded-img-item").remove();
});

// **************** End ***************** //


// ************ Review Modal Jquery ******************
$(document).on("click", "#review_modal_btn", function() {
    let activityId = $(this).data("activity-id");
    let bookingId = $(this).data("booking-id");
    $("#ratingReview #review_description").val("");
    $("#ratingReview input[name='rating']").prop("checked", false);
    $("#rating_review_btn").removeClass("btn-disabled");
    $("#rating_review_btn").data("activity-id", activityId);
    $("#rating_review_btn").data("booking-id", bookingId);
});

$(document).on("click", "#rating_review_btn", function() {
    $("#p_loader").removeClass("d-none");

    const review = $("#ratingReview #review_description").val();
    const rating = $("#ratingReview input[name='rating']:checked").val() || null;
    let activityId = $(this).data("activity-id");
    let bookingId = $(this).data("booking-id");

    if(!review){
        $("#p_loader").addClass("d-none");
        showToast(0, "Please enter review.");
        return;
    };

    if(!rating){
        $("#p_loader").addClass("d-none");
        showToast(0, "Please select rating.");
        return;
    };

    const formData = new FormData();

    formData.append("activityId", activityId);
    formData.append("bookingId", bookingId);
    formData.append("review", review);
    formData.append("rating", rating);

    // Upload multiple images
    const files = document.getElementById("fileRatingInput").files;
    for (let i = 0; i < files.length; i++) {
        formData.append('reviewImages[]', files[i]);
    };

    $(this).addClass("btn-disabled");

    postFileCall("/add-rating", formData, function(response) {
        if(response.flag === 1) {
            setTimeout(() => {
                $("#p_loader").addClass("d-none");
            }, 800);
            setTimeout(() => {
                showToast(response.flag, response.msg);
            }, 1200);
            setTimeout(() => {
                location.reload(1);
            }, 2000);
        } else {
            $("#p_loader").addClass("d-none");
            showToast(response.flag, response.msg);
            $("#rating_review_btn").removeClass("btn-disabled");
        };
    });
});

$(document).on("click", ".activity_details_redirect", function(e) {
    let activity_id = $(this).data("activity-id");
    window.location.href = "/activity-details/" + activity_id;
});

function setBookingList() {
    let data = {};
    if (bookingFilter && bookingFilter !== "" && bookingFilter !== undefined && bookingFilter !== null) {
        data.tripStatus = parseInt(bookingFilter);
    };

    postAjaxCall('/booking-list', data, function(response) {
        if (response.flag === 1) {
            $(".booking_list").html(response.data);
        };
    });
};

function handleRatingFiles(files, fileIndex) {
    $.each(files, function(index, file) {
        if (!file.type.startsWith('image/')) {
            showToast(0, 'Please select an image file');
            return;
        };

        const reader = new FileReader();

        reader.onload = function(e) {
            if (fileIndex !== undefined) {
                filesArray[fileIndex] = file;
                $("#uploaded-img-preview").find(`#uploaded-img-item-${fileIndex}`).find("img").attr("src", e.target.result);
                return;
            };

            filesArray.push(file);

            let nextIndex = filesArray.length - 1;
            if (files.length > 1) {
                nextIndex = filesArray.length - files.length + index;
            };

            const uploadedImgPreviewDiv = `
                <div id="uploaded-img-item-${nextIndex}" class="uploaded-img-item">
                    <div class="image-action">
                        <button class="replace-image" data-index=${nextIndex}>Replace</button>
                        <button class="remove-image" data-index=${nextIndex}>Remove</button>
                    </div>
                    <img src="${e.target.result}" alt="">
                </div>`;
                $('#uploaded-img-preview').append(uploadedImgPreviewDiv);
        };

        reader.readAsDataURL(file);
    });
};
