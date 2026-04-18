$(document).ready(function() {
    $("#p_loader").addClass("d-none");
    setReviewList()
});

$(document).on("change", "#sortSelector", function () {
    const sortValue = $(this).val();

    let sortParam = {
        sortDirection: parseInt(sortValue),
    };
    setReviewList(sortParam);
});

$(document).on("click", "#review-btn", function () {
    const activity = $(this).data('activity');
    const review = $(this).data('review');
    const ratings = $(this).data('ratings');
    const userName = $(this).data('username');
    const operatorName = $(this).data('operatorname');
    const tripDate = $(this).data('tripdate');
    
    $("#numericRating-1").text(ratings > 0 ? ratings : "NA");
    const stars = $("#starRating-1 .star-item");
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
    const formattedTripDate = formatDate(tripDate);

    $("#activity-1").text(activity);     
    $("#review").text(review);         
    $("#ratings-1").text(ratings);        
    $("#operatorname-1").text(operatorName); 
    $("#username-1").text(userName);
    $("#tripdate-1").text(formattedTripDate);  
    $("#reviewStatus").modal('show');
});

function setReviewList(extraParams = {}) {
    filters = {
        ...filters,
        ...extraParams,
    };
    filterPaginationData("/review-agression-list", "table-data", "pagination_table_view");
}

function formatDate(date) {
    if (!date || date === "-") return "-"; 
    let d = new Date(date);
    if (isNaN(d.getTime())) return "-"; 
    let day = ("0" + d.getDate()).slice(-2); 
    let month = ("0" + (d.getMonth() + 1)).slice(-2);  
    let year = d.getFullYear();
    return `${day}-${month}-${year}`;
}
