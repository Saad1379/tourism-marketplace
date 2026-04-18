$(document).ready(function() {
    $("#p_loader").addClass("d-none");
});

$(document).on("click", ".see_all_activity", function(e) {
    let activity_type = $(this).data("activity-type");
    window.location.href = "/activity/" + activity_type;
});

$(document).on("click", ".activity_details_redirect", function(e) {
    let activity_id = $(this).data("activity-id");
    window.location.href = "/activity-details/" + activity_id;
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
