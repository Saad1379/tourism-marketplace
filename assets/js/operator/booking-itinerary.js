$(document).ready(function() {
    $("#p_loader").addClass("d-none");
    setBookingList()
});

$(document).on("change", "#sortSelector", function () {
    const sortValue = $(this).val();

    let sortParam = {
        sortDirection: parseInt(sortValue),
    };
    setBookingList(sortParam);
});

$(document).on("click", "#booking-status", function () {
    const activity = $(this).data('activity');
    const userName = $(this).data('username');
    const status = $(this).data('status');
    const bookingId = $(this).data('bookingid');
    const paymentStatus = $(this).data('payment');
    const date = $(this).data('date');
    const formattedcreatedAt = formatDate(date);
    const guest = $(this).data('guest');
    const itineraryOrigin = $(this).data('itinerary-origin');
    const itineraryDestination = $(this).data('itinerary-destination');
    const itineraryAccommodation = $(this).data('itinerary-accommodation');
    const ratings = parseFloat($(this).data('ratings') || 0);

    $("#activity").text(activity);           
    $("#username").text(userName); 
    $("#date").text(formattedcreatedAt);
    $("#bookingId").text("Booking Id - " + bookingId);
    $("#guest").text(guest);
    $("#itineraryOrigin").text(itineraryOrigin);
    $("#itineraryDestination").text(itineraryDestination);
    $("#itineraryAccommodation").text(itineraryAccommodation);

    $("#numericRating").text(ratings > 0 ? ratings : "NA");
    const stars = $("#starRating .star-item");
    stars.removeClass("filled empty");

    stars.each(function(index) {
        if (index < Math.floor(ratings)) {
            $(this).addClass("filled"); 
        } else if (index < ratings) {
            $(this).addClass("half-filled"); 
        } else {
            $(this).addClass("empty"); 
        }
    });

    let statusText = '';
    switch (status) {
        case 1:
            statusText = 'Upcoming';
            $("#status").removeClass("badge-success");
            $("#status").removeClass("badge-danger");
            $("#status").addClass("badge-warning");
            break;
        case 2:
            statusText = 'Confirmed';
            $("#status").removeClass("badge-warning");
            $("#status").removeClass("badge-danger");
            $("#status").addClass("badge-success");
            break;
        case 3:
            statusText = 'Cancelled ';
            $("#status").removeClass("badge-success");
            $("#status").removeClass("badge-warning");
            $("#status").addClass("badge-danger");
            break;
        default:
            statusText = 'Upcoming';
            $("#status").removeClass("badge-success");
            $("#status").removeClass("badge-danger");
            $("#status").addClass("badge-warning");
    };
    $("#status").text(statusText);

    let paymentStatusText = '';
    switch (paymentStatus) {
        case 1:
            paymentStatusText = 'Pending';
            $("#paymentStatus").removeClass("badge-success");
            $("#paymentStatus").removeClass("badge-danger");
            $("#paymentStatus").addClass("badge-warning");
            break;
        case 2:
            paymentStatusText = 'Completed';
            $("#paymentStatus").removeClass("badge-warning");
            $("#paymentStatus").removeClass("badge-danger");
            $("#paymentStatus").addClass("badge-success");
            break;
        case 3:
            paymentStatusText = 'Failed';
            $("#paymentStatus").removeClass("badge-success");
            $("#paymentStatus").removeClass("badge-warning");
            $("#paymentStatus").addClass("badge-danger");
            break;
        default:
            paymentStatusText = 'Pending';
            $("#paymentStatus").removeClass("badge-success");
            $("#paymentStatus").removeClass("badge-danger");
            $("#paymentStatus").addClass("badge-warning");
    };
    $("#paymentStatus").text(paymentStatusText);

    $("#bookingStatus").modal('show'); 
});

function setBookingList(extraParams = {}) {
    filters = {
        ...filters,
        ...extraParams,
    };

    filterPaginationData("/booking-list", "table-data", "pagination_table_view");
}

function formatDate(date) {
    let d = new Date(date);
    let day = ("0" + d.getDate()).slice(-2); 
    let month = ("0" + (d.getMonth() + 1)).slice(-2);  
    let year = d.getFullYear();

    let hours = d.getHours();
    let minutes = d.getMinutes().toString().padStart(2, '0');
    let ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;

    return `${day}-${month}-${year} ${hours}:${minutes} ${ampm}`;
}
