$(".copy_referral_link_btn").click(function() {
    let referralLink = $("#referral_link_url").data("referral-link");

    let tempInput = $("<input>");
    $("body").append(tempInput);

    tempInput.val(referralLink).select();

    document.execCommand("copy");

    tempInput.remove();

    $(".referral_tooltip").text("Copied!").fadeIn(200).fadeOut(1500);
});

$(document).ready(function() {
    $("#p_loader").addClass("d-none");
    setBookingList()
});

$(document).on("click", ".date-range", function () {
    const days = $(this).data("range");
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - days);

    setBookingList({ dateFrom: dateFrom.toISOString() });

    $("#dateFilterBtn span").text($(this).text());
});

$(document).on("click", "#booking-status", function () {
    const activity = $(this).data('activitys');
    const userName = $(this).data('usernames');
    const phones = $(this).data('phones');  
    const mettingpointnames = $(this).data('mettingpointnames'); 
    $("#activitys").text(activity);           
    $("#usernames").text(userName); 
    $("#phones").text(phones); 
    $("#mettingpointnames").text(mettingpointnames);
 
    $("#bookings").modal('show'); 
});

function setBookingList(extraParams = {}) {
    filters = {
        ...filters,
        ...extraParams,
    };

    filterPaginationData("/upcoming-booking-list", "table-data", "pagination_table_view");
}
