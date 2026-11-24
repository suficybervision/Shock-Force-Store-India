import { Language } from '../types/store';

export const TRANSLATIONS: Record<
  Language,
  {
    navProduct: string;
    navSpecs: string;
    navTrack: string;
    navAdmin: string;
    cartLabel: string;
    priceNote: string;
    inStock: string;
    outOfStock: string;
    quantity: string;
    addToCart: string;
    buyNow: string;
    notifyMeBtn: string;
    checkoutUnavailableNote: string;
    launchNoticeTitle: string;
    launchNoticeBody: string;
    safetyWarningsHeading: string;
    specsHeading: string;
    shippingReturnsHeading: string;
    faqHeading: string;
    reviewsHeading: string;
    reviewsEmpty: string;
    shippingPolicyLabel: string;
    returnPolicyLabel: string;
    deliveryEstimateLabel: string;
    checkPinPlaceholder: string;
    checkBtn: string;
    cartTitle: string;
    cartEmpty: string;
    subtotal: string;
    deliveryCharge: string;
    totalPayable: string;
    proceedToCheckout: string;
    checkoutTitle: string;
    fullName: string;
    mobileNumber: string;
    stateLabel: string;
    cityLabel: string;
    pinCodeLabel: string;
    fullAddressLabel: string;
    landmarkLabel: string;
    placeOrderBtn: string;
    paymentTitle: string;
    paymentSubtitle: string;
    utrLabel: string;
    screenshotLabel: string;
    submitProofBtn: string;
    trackOrderTitle: string;
    trackOrderDesc: string;
    orderIdLabel: string;
    lookupBtn: string;
    faqs: Array<{ q: string; a: string }>;
  }
> = {
  en: {
    navProduct: 'Product',
    navSpecs: 'Specifications',
    navTrack: 'Track Order',
    navAdmin: 'Admin',
    cartLabel: 'Cart',
    priceNote: 'Product price ₹299 + ₹199 delivery charge (₹498 total for 1 unit)',
    inStock: 'Available for order',
    outOfStock: 'Currently out of stock',
    quantity: 'Quantity',
    addToCart: 'Add to Cart',
    buyNow: 'BUY NOW',
    notifyMeBtn: 'Proceed to Checkout',
    checkoutUnavailableNote:
      'Payment collection is disabled until product safety and legal compliance approval has been independently verified.',
    launchNoticeTitle: 'Product Safety & Compliance Gate',
    launchNoticeBody:
      'Payment collection remains disabled until applicable Indian electrical safety, product safety, and legal compliance requirements are independently verified.',
    safetyWarningsHeading: 'Important Safety Warnings & Approved Usage',
    specsHeading: 'Technical Specifications',
    shippingReturnsHeading: 'Shipping & Return Policies',
    faqHeading: 'Frequently Asked Questions',
    reviewsHeading: 'Verified Customer Reviews',
    reviewsEmpty:
      'No verified customer reviews yet. Reviews appear here only after an order has been verified and marked Delivered.',
    shippingPolicyLabel: 'Shipping Policy',
    returnPolicyLabel: 'Return Policy',
    deliveryEstimateLabel: 'Check Delivery Charge by PIN Code',
    checkPinPlaceholder: 'Enter 6-digit PIN (e.g. 560001)',
    checkBtn: 'Check',
    cartTitle: 'Your Cart',
    cartEmpty: 'Your cart is currently empty.',
    subtotal: 'Product Subtotal',
    deliveryCharge: 'Delivery Charge',
    totalPayable: 'Final Total Payable',
    proceedToCheckout: 'Proceed to Checkout',
    checkoutTitle: 'Shipping Details (India)',
    fullName: 'Full Name',
    mobileNumber: '10-Digit Indian Mobile Number',
    stateLabel: 'State / UT',
    cityLabel: 'City / District',
    pinCodeLabel: '6-Digit PIN Code',
    fullAddressLabel: 'Complete Street Address',
    landmarkLabel: 'Landmark (Optional)',
    placeOrderBtn: 'Continue to UPI Payment',
    paymentTitle: 'Complete UPI Payment',
    paymentSubtitle:
      'Scan the dynamically generated UPI QR code containing your exact payable amount and Order ID, or pay to the Merchant UPI ID.',
    utrLabel: '12-Digit UTR / UPI Transaction Reference',
    screenshotLabel: 'Upload Payment Screenshot (JPG, PNG, WebP · Max 5 MB)',
    submitProofBtn: 'Submit Payment Proof for Verification',
    trackOrderTitle: 'Track Order',
    trackOrderDesc: 'Enter your unique Order ID (e.g. SSI-20261124-001) to view real-time order, payment, and shipping status.',
    orderIdLabel: 'Unique Order ID',
    lookupBtn: 'TRACK ORDER',
    faqs: [
      {
        q: 'When is UPI payment enabled?',
        a: 'Payment collection stays disabled until independent Indian product safety, electrical safety, and consumer protection compliance is verified by the business owner. Once approved, UPI payment is enabled.',
      },
      {
        q: 'How is my UPI payment verified?',
        a: 'Submitting a UTR number and payment screenshot puts your order into Pending Verification. Our team manually verifies the actual credit in the merchant bank/UPI statement before approving dispatch.',
      },
      {
        q: 'How are delivery charges calculated?',
        a: 'Delivery charges are configured by the store administrator either as a flat rate across India or based on your 6-digit PIN code, and are always shown clearly before payment.',
      },
      {
        q: 'Can this footwear be used on people or animals?',
        a: 'No. Never discharge static electricity or shock toward people or animals. Follow all written safety warnings strictly.',
      },
    ],
  },
  hi: {
    navProduct: 'उत्पाद',
    navSpecs: 'विशेषताएँ',
    navTrack: 'ऑर्डर ट्रैक करें',
    navAdmin: 'एडमिन',
    cartLabel: 'कार्ट',
    priceNote: 'उत्पाद मूल्य ₹299 + ₹199 डिलीवरी शुल्क (1 यूनिट के लिए कुल ₹498)',
    inStock: 'ऑर्डर के लिए उपलब्ध',
    outOfStock: 'वर्तमान में स्टॉक समाप्त',
    quantity: 'मात्रा',
    addToCart: 'कार्ट में जोड़ें',
    buyNow: 'अभी खरीदें (BUY NOW)',
    notifyMeBtn: 'चेकआउट पर जाएँ',
    checkoutUnavailableNote:
      'उत्पाद सुरक्षा और कानूनी अनुपालन की स्वतंत्र पुष्टि होने तक भुगतान संग्रह बंद रहेगा।',
    launchNoticeTitle: 'उत्पाद सुरक्षा और अनुपालन जाँच',
    launchNoticeBody:
      'भारतीय विद्युत और उत्पाद सुरक्षा मानकों की स्वतंत्र पुष्टि होने तक भुगतान संग्रह बंद है।',
    safetyWarningsHeading: 'महत्वपूर्ण सुरक्षा चेतावनियाँ और निर्देश',
    specsHeading: 'तकनीकी विशिष्टताएँ',
    shippingReturnsHeading: 'शिपिंग और रिटर्न नीतियाँ',
    faqHeading: 'अक्सर पूछे जाने वाले प्रश्न',
    reviewsHeading: 'सत्यापित ग्राहक समीक्षाएँ',
    reviewsEmpty:
      'अभी तक कोई सत्यापित ग्राहक समीक्षा नहीं है। समीक्षाएँ केवल डिलीवर किए गए वास्तविक ऑर्डर के बाद ही प्रकाशित की जाती हैं।',
    shippingPolicyLabel: 'शिपिंग नीति',
    returnPolicyLabel: 'रिटर्न नीति',
    deliveryEstimateLabel: 'पिन कोड द्वारा डिलीवरी शुल्क जाँचें',
    checkPinPlaceholder: '6 अंकों का पिन कोड दर्ज करें (जैसे 560001)',
    checkBtn: 'जाँचें',
    cartTitle: 'आपका कार्ट',
    cartEmpty: 'आपका कार्ट अभी खाली है।',
    subtotal: 'उत्पाद उप-योग',
    deliveryCharge: 'डिलीवरी शुल्क',
    totalPayable: 'कुल देय राशि',
    proceedToCheckout: 'चेकआउट पर जाएँ',
    checkoutTitle: 'डिलीवरी का पता (भारत)',
    fullName: 'पूरा नाम',
    mobileNumber: '10 अंकों का भारतीय मोबाइल नंबर',
    stateLabel: 'राज्य / केंद्र शासित प्रदेश',
    cityLabel: 'शहर / जिला',
    pinCodeLabel: '6 अंकों का पिन कोड',
    fullAddressLabel: 'पूरा पता',
    landmarkLabel: 'निकटतम पहचान चिह्न (वैकल्पिक)',
    placeOrderBtn: 'UPI भुगतान पर आगे बढ़ें',
    paymentTitle: 'UPI भुगतान पूरा करें',
    paymentSubtitle:
      'सटीक कुल राशि और ऑर्डर आईडी के साथ बने UPI QR कोड को स्कैन करें या मर्चेंट UPI ID पर भुगतान करें।',
    utrLabel: 'UTR / UPI ट्रांजेक्शन रेफरेंस नंबर',
    screenshotLabel: 'भुगतान स्क्रीनशॉट अपलोड करें (JPG, PNG, WebP · अधिकतम 5 MB)',
    submitProofBtn: 'सत्यापन के लिए भुगतान प्रमाण जमा करें',
    trackOrderTitle: 'ऑर्डर ट्रैक करें',
    trackOrderDesc: 'ऑर्डर, भुगतान और शिपिंग की स्थिति देखने के लिए अपना यूनीक ऑर्डर आईडी (जैसे SSI-20261124-001) दर्ज करें।',
    orderIdLabel: 'ऑर्डर आईडी',
    lookupBtn: 'TRACK ORDER',
    faqs: [
      {
        q: 'चेकआउट क्यों बंद हो सकता है?',
        a: 'शॉक शू एक प्रोटोटाइप उत्पाद है। व्यवसाय स्वामी द्वारा भारतीय सुरक्षा और कानूनी अनुपालन की पुष्टि होने तक बिक्री और भुगतान बंद रखे जाते हैं।',
      },
      {
        q: 'मेरे UPI भुगतान का सत्यापन कैसे होता है?',
        a: 'UTR नंबर और स्क्रीनशॉट जमा करने के बाद आपका ऑर्डर लंबित सत्यापन में जाता है। हमारी टीम बैंक खाते में वास्तविक राशि आने की पुष्टि के बाद ही ऑर्डर स्वीकृत करती है।',
      },
      {
        q: 'डिलीवरी शुल्क की गणना कैसे की जाती है?',
        a: 'डिलीवरी शुल्क एडमिन द्वारा तय किया जाता है (फ्लैट दर या पिन कोड आधारित) और भुगतान से पहले स्पष्ट दिखाया जाता है।',
      },
      {
        q: 'क्या इसका उपयोग लोगों या जानवरों पर किया जा सकता है?',
        a: 'नहीं। किसी भी व्यक्ति या जानवर को बिजली या स्टैटिक झटका देने के लिए इसका उपयोग कदापि न करें।',
      },
    ],
  },
};
