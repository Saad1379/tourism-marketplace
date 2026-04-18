$(document).ready(function() {
    $("#p_loader").addClass("d-none");
    setCancellationList();
});

$(document).on("click", "#open-cancellation-popup", function() {
    $("#cancellation-amt").html($(this).data("amount"));
    $("#cancellation-status").html($(this).data("status")).removeClass().addClass("badge " + $(this).data("status-class"));
    $("#cancellation-booking-date").html($(this).data("booking"));
    $("#cancellation-date").html($(this).data("cancellation"));
    $("#cancellation-reason").html($(this).data("cancellation-reason"));
    if ($(this).data("user") != "") {
        $("#cancellation-pop-up-title").html(`${$(this).data("user")} Cancellation Details for ${$(this).data("activity")}`);
    }
})

function setCancellationList() {
    filterPaginationData("/cancellation/list", "table-data", "pagination_table_view");
};
