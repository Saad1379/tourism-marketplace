$(document).ready(function() {
    const linkToShare = $("#referral_link_url").data("referral-link");
    const encodedLink = encodeURIComponent(linkToShare);

    // WhatsApp URL
    const whatsappUrl = `https://wa.me/?text=${encodedLink}`;
    $("#whatsapp_link").attr("href", whatsappUrl);

    // Facebook URL
    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodedLink}`;
    $("#facebook_link").attr("href", facebookUrl);

    // Instagram URL
    const instagramUrl = `https://www.instagram.com/?url=${encodedLink}`;
    $("#instagram_link").attr("href", instagramUrl);
});

$(document).on("click", ".copy_referral_link_btn", function(e) {
    let referralLink = $("#referral_link_url").data("referral-link");

    let tempInput = $("<input>");
    $("body").append(tempInput);

    tempInput.val(referralLink).select();

    document.execCommand("copy");

    tempInput.remove();

    $(".referral_tooltip").text("Copied!").fadeIn(200).fadeOut(1500);
});
