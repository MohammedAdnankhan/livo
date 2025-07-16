const ENVIRONMENTS = {
  DEV: "development",
  STAGING: "staging",
  PROD: "production",
};

const LANGUAGES = {
  EN: "en",
  AR: "ar",
};

const VISITOR_STATUSES = {
  DENIED: "denied",
  CHECKIN: "checkin",
  CHECKOUT: "checkout",
  PENDING: "pending",
  APPROVED: "approved",
};

const ACTION_TYPES = {
  REPLIED: {
    content_en: "%var% replied to your comment",
    content_ar: "%var% replied to your comment",
    key: "REPLIED",
  },
  COMMENTED: {
    content_en: "%var% commented on your post",
    content_ar: "%var% commented on your post",
    key: "COMMENTED",
  },
  REPLIED_TO_COMMENT: {
    content_en: "%var% replied to your comment on %var%'s post",
    content_ar: "%var% replied to your comment on %var%'s post",
    key: "REPLIED_TO_COMMENT",
  },
  LIKED: {
    content_en: "%var% liked your post",
    content_ar: "%var% liked your post",
    key: "LIKED",
  },
  SHARED: {
    content_en: "%var% shared your post",
    content_ar: "%var% shared your post",
    key: "SHARED",
  },
  ENTRY_DENIED: {
    content_en: "You denied the entry of %var%",
    content_ar: "You denied the entry of %var%",
    key: "ENTRY_DENIED",
  },
  ENTRY_DENIED_BY_GUARD: {
    content_en: "%var% entry is denied by Guard",
    content_ar: "%var% entry is denied by Guard",
    key: "ENTRY_DENIED_BY_GUARD",
  },
  ENTRY_APPROVED: {
    content_en: "You approved the entry of %var%",
    content_ar: "You approved the entry of %var%",
    key: "ENTRY_APPROVED",
  },
  ABOUT_TO_ARRIVE: {
    content_en: "Your pre approved %var% is about to arrive",
    content_ar: "Your pre approved %var% is about to arrive",
    key: "ABOUT_TO_ARRIVE",
  },
  ENTERED_BUILDING: {
    content_en: "Your approved visitor %var% has entered the premises",
    content_ar: "Your approved visitor %var% has entered the premises",
    key: "ENTERED_BUILDING",
  },
  LEFT_BUILDING: {
    content_en: "Your approved visitor %var% has left the premises",
    content_ar: "Your approved visitor %var% has left the premises",
    key: "LEFT_BUILDING",
  },
  AUTO_CHECKOUT: {
    content_en:
      "Your approved visitor %var% has been checked out after 48 hours",
    content_ar:
      "Your approved visitor %var% has been checked out after 48 hours",
    key: "AUTO_CHECKOUT",
  },
  ENTRY_REQUESTED: {
    content_en: "%var% wants to visit you",
    content_ar: "%var% wants to visit you",
    key: "ENTRY_REQUESTED",
  },
  NEW_PAYMENT: {
    content_en: "You have a new payment, click here to pay.",
    content_ar: "You have a new payment, Click here to pay.",
    key: "NEW_PAYMENT",
  },
  REQUEST_STATUS_CHANGE: {
    content_en: "Your request #%id% has been changed to %var% stage",
    content_ar: "Your request #%id% has been changed to %var% stage",
    key: "REQUEST_STATUS_CHANGE",
  },
};

const SOURCE_TYPES = {
  VISITING: "visiting",
  POST: "post",
  SHARED_POST: "shared_post",
  CHARGE: "charge",
  MAINTENANCE: "maintenance",
};

const DEVICE_TYPES = {
  ANDROID: "android",
  IOS: "ios",
};

const TIMEZONES = {
  UAE: "Asia/Dubai",
  INDIA: "Asia/Kolkata",
};

const USER_TYPES = {
  USER: "user",
  GUARD: "guard",
  ADMIN: "admin",
  OWNER: "owner",
  STAFF: "staff",
  SUPER_ADMIN:"superAdmin"
};

const ADMIN_ROLES = {
  ADMIN: "Admin",
  MASTER_ADMIN: "Master Admin",
};

const USER_ROLES = {
  OWNER: "Owner",
  RESIDENT: "Resident",
  RESIDING_OWNER: "Residing Owner",
};

const USER_FILTERS = {
  OWNER: "Owner",
  RESIDENT: "Resident",
  RESIDING_OWNER: "Residing Owner",
  NEW_USER: "New User",
};

const COMMON_DATE_FORMAT = "DD/MM/YYYY hh:mm a";

const DATE_FORMAT = "DD/MM/YYYY";

const TIME_FORMAT = "HH:mm";

const TARGET_AUDIENCE = {
  BUILDING: "building",
  LOCALITY: "locality",
};

const VISITOR_CATEGORIES = {
  GUEST: "Guest",
  DELIVERY: "Delivery",
  HOME_SERVICES: "Home Services",
  DAILY_HELP: "Daily Help",
  CAB: "Cab",
  Others: "Others",
  VIEWING: "Viewing",
};

const ITEM_CONDITIONS = {
  BRAND_NEW: {
    condition_en: "Brand New",
    condition_ar: "علامة تجارية جديدة",
    img: "https://livodev.s3.us-east-2.amazonaws.com/brand-new-1650341931622.png",
  },
  SLIGHTLY_USED: {
    condition_en: "Slightly Used",
    condition_ar: "تستخدم قليلا",
    img: "https://livodev.s3.us-east-2.amazonaws.com/slightly-used-1650341931622.png",
  },
  USED: {
    condition_en: "Used",
    condition_ar: "مستخدم",
    img: "https://livodev.s3.us-east-2.amazonaws.com/used-1650341931622.png",
  },
  USED_POOR_CONDITION: {
    condition_en: "Used-poor condition",
    condition_ar: "مستعملة-حالة سيئة",
    img: "https://livodev.s3.us-east-2.amazonaws.com/used-poor-condition-1650341931623.png",
  },
};

const ITEM_CATEGORIES = {
  FASHION: {
    category_en: "Fashion",
    category_ar: "موضه",
    img: "https://livodev.s3.amazonaws.com/fashion-1650284244778.png",
  },
  MOBILES: {
    category_en: "Mobiles",
    category_ar: "جوال",
    img: "https://livodev.s3.amazonaws.com/mobiles-1650284244816.png",
  },
  ELECTRONICS: {
    category_en: "Electronics",
    category_ar: "إلكترونيات",
    img: "https://livodev.s3.amazonaws.com/electronics-1650284244777.png",
  },
  HOME: {
    category_en: "Home",
    category_ar: "الصفحة الرئيسية",
    img: "https://livodev.s3.amazonaws.com/home-1650284244808.png",
  },
  APPLIANCES: {
    category_en: "Appliances",
    category_ar: "الأجهزة",
    img: "https://livodev.s3.amazonaws.com/appliances-1650284244774.png",
  },
  FURNITURE: {
    category_en: "Furniture",
    category_ar: "أثاث",
    img: "https://livodev.s3.amazonaws.com/furniture-1650284244779.png",
  },
  OTHERS: {
    category_en: "Others",
    category_ar: "آحرون",
    img: "https://livodev.s3.amazonaws.com/other-1649765865154.png",
  },
};

const CURRENCY = {
  AED: "aed",
  USD: "usd",
};

const INVOICE_TYPES = {
  LEASE: "LEASE",
  PRODUCTS: "PRODUCTS",
};

const INVOICE_FOR = {
  Individual: "Individual",
  Company: "Company",
};

const MAINTENANCE_STATUSES = {
  PENDING: {
    status_en: "Open",
    status_ar: "قيد الانتظار",
    key: "PENDING",
  },
  ASSIGNED: {
    status_en: "Assigned",
    status_ar: "assigned_ar",
    key: "ASSIGNED",
  },
  RE_ASSIGNED: {
    status_en: "Re-Assigned",
    status_ar: "Re-assigned_ar",
    key: "RE_ASSIGNED",
  },
  PROCESSING: {
    status_en: "In-Process",
    status_ar: "معالجة",
    key: "PROCESSING",
  },
  QUOTATION_NEEDED: {
    status_en: "Need Quotation",
    status_ar: "need_quotation ar",
    key: "QUOTATION_NEEDED",
  },
  QUOTATION_SENT: {
    status_en: "Quotation Sent",
    status_ar: "quotation_sent ar",
    key: "QUOTATION_SENT",
  },
  QUOTATION_APPROVED: {
    status_en: "Quotation Approved",
    status_ar: "quotation_approved ar",
    key: "QUOTATION_APPROVED",
  },
  QUOTATION_REJECTED: {
    status_en: "Quotation Rejected",
    status_ar: "quotation_rejected ar",
    key: "QUOTATION_REJECTED",
  },
  COMPLETED: {
    status_en: "Completed",
    status_ar: "مكتمل",
    key: "COMPLETED",
  },
  CANCELLED: {
    status_en: "Cancelled",
    status_ar: "ألغيت",
    key: "CANCELLED",
  },
  ON_HOLD: {
    status_en: "On Hold",
    status_ar: "On hold arabic",
    key: "ON_HOLD",
  },
  REJECTED: {
    status_en: "Rejected",
    status_ar: "Rejected arabic",
    key: "REJECTED",
  },
  RE_OPEN: {
    status_en: "Re-open",
    status_ar: "Re-opened arabic",
    key: "RE_OPEN",
  },
};

const MAINTENANCE_TYPES = {
  PLUMBING: {
    type_en: "Plumbing",
    type_ar: "السباكة",
  },
  ELECTRICITY: {
    type_en: "Electrical",
    type_ar: "كهرباء",
  },
  FURNITURE: {
    type_en: "Furniture",
    type_ar: "أثاث",
  },
  PARKING: {
    type_en: "Parking",
    type_ar: "أثاث",
  },
  PAINTING: {
    type_en: "Painting",
    type_ar: "أثاث",
  },
  COMPLAINS: {
    type_en: "Complain",
    type_ar: "Complain_ar",
  },
  CARPENTRY: {
    type_en: "Carpentry",
    type_ar: "أثاث",
  },
  CEILING: {
    type_en: "Ceiling Work",
    type_ar: "Ceiling Work ar",
  },
  PAINT: {
    type_en: "Paint Job",
    type_ar: "Paint Job ar",
  },
  GLASS_WORK: {
    type_en: "Glass Work",
    type_ar: "Glass work_ar",
  },
  POOL: {
    type_en: "Pool Maintenance",
    type_ar: "Pool Maintenance_ar",
  },
  AMENITIES: {
    type_en: "Amenities",
    type_ar: "أثاث",
  },
  AC: {
    type_en: "AC",
    type_ar: "أثاث",
  },
  OTHERS: {
    type_en: "Miscellaneous",
    type_ar: "آحرون",
  },
};

const PIXLAB_DOCUMENT_TYPES = {
  //   passport: {
  //     en: "Passport",
  //     ar: "جواز سفر",
  //     image:
  //       "https://livodev.s3.us-east-2.amazonaws.com/passport-1649913561769.png",
  //   },
  //   visa: {
  //     en: "Visa",
  //     ar: "تأشيرة دخول",
  //     image: "https://livodev.s3.us-east-2.amazonaws.com/visa-1649913561769.png",
  //   },
  idcard: {
    en: "Id Card",
    ar: "بطاقة التعريف",
    image:
      "https://livodev.s3.us-east-2.amazonaws.com/emirates-id-1649913561770.png",
  },
};

const PIXLAB_SUPPORTED_COUNTRIES = {
  // malaysia: {
  //   name_en: "Malaysia (MyKad)",
  //   name_ar: "Malaysia (MyKad)",
  // },
  // india: {
  //   name_en: "India (Aadhar Card)",
  //   name_ar: "India (Aadhar Card)",
  // },
  // singapore: {
  //   name_en: "Singapore",
  //   name_ar: "Singapore",
  // },
  uae: {
    name_en: "UAE (Emirates Id)",
    name_ar: "UAE (Emirates Id)",
  },
  // us: {
  //   name_en: "US (Driving License)",
  //   name_ar: "US (Driving License)",
  // },
  // czech: {
  //   name_en: "Czech Republic",
  //   name_ar: "Czech Republic",
  // },
};

const CHARGE_TYPES = {
  MAINTENANCE: {
    charge_en: "Maintenance Charge",
    charge_ar: "اعمال صيانة",
    key: "MAINTENANCE",
  },
  SERVICE: {
    charge_en: "Service Charge",
    charge_ar: "تكلفة الخدمة",
    key: "SERVICE",
  },
  RENT: {
    charge_en: "Rental Payments",
    charge_ar: "إيجار",
    key: "RENT",
  },
  OTHER: {
    charge_en: "Other Charges",
    charge_ar: "رسوم أخرى",
    key: "OTHER",
  },
};

const PAYMENT_STATUSES = {
  PENDING: {
    en: "Pending",
    ar: "قيد الانتظار",
    key: "PENDING",
  },
  COMPLETED: {
    en: "Completed",
    ar: "مكتمل",
    key: "COMPLETED",
  },
  FAILED: {
    en: "Failed",
    ar: "باءت بالفشل",
    key: "FAILED",
  },
};

const INVOICE_PAYMENT_STATUSES = {
  OPENED: "Opened",
  PAYMENT_RECEIVED: "Payment received",
  PAID: "Paid",
};

const BUILDING_TYPES = {
  // VILLA: "Villa",
  // FLAT: "Flat",
  // FLAT_AND_VILLA: "Flat And Villa",
  RESIDENTIAL: "Residential",
  COMMERCIAL: "Commercial",
  CO_LIVING: "Co-Living",
  CO_WORKING: "Co-Working",
  OTHERS: "Others",
};

const FLAT_SIZES = {
  ONE: "1 BHK",
  TWO: "2 BHK",
  THREE: "3 BHK",
  FOUR: "4 BHK",
  FIVE: "5 BHK",
  STUDIO: "Studio",
  SHOP: "Shop",
};

const FLAT_TYPES = {
  STUDIO: "Studio",
  SHOP: "Shop",
  APARTMENT: "Apartment",
  VILLA: "Villa",
  DUPLEX: "Duplex",
  OFFICE: "Office",
  STORAGE: "Storage",
  BEACH: "Beach House",
  FARM: "Farm",
  OTHERS: "Others",
};

const FLAT_FURNISHINGS = {
  FURNISHED: "Furnished",
  PARTIAL: "Partially Furnished",
  UN_FURNISHED: "Unfurnished",
};

const APPOINTMENT_TYPES = {
  FULL_TIME: "Full Time",
  CONTRACTUAL: "Contractual",
};

const DESIGNATION_TYPES = {
  MANAGER: "Manager",
  ASSOCIATE: "Associate",
  ASSISTANT: "Assistant",
  CONTRACTUAL: "Contractual",
};

const RENEWAL_PERIOD_TYPE = {
  MONTHS: "Months",
  YEARS: "Years",
};

const DEPARTMENT_TYPES = {
  FRONT_DESK: "Front Desk",
  HOUSEKEEPING: "Housekeeping",
  ENGINEERING: "Engineering",
  SECURITY: "Security",
  DAILY_HELP: "Daily Help",
  CONTRACTUAL: "Contractual",
};

const CHARGE_CATEGORIES = {
  HOUSEKEEPING: "Housekeeping",
  ENGINEERING: "Engineering",
  OTHER: "Other",
};

const SERVICE_TAX = 10;

const REPORT_REASONS = {
  INAPPROPRIATE_CONTENT: "In-appropriate Content",
  SCAM: "Scam or Fraud",
  FALSE_INFORMATION: "False Information",
  BULLYING: "Bullying or Harassment",
  OTHER: "Other",
};

const PASSWORD_CHANGED_TEMPLATE = {
  SUBJECT: "Password Changed Successfully",
  TEMPLATE:
    "Your password has been changed successfully. If you didn't changed your password please contact us at team@livo.ae \n \n Regards, \n Team Livo",
  KEY: "password change successfull request",
};

const SIGNUP_REQUEST_REJECTED = {
  SUBJECT: "Livo Request Rejected",
  TEMPLATE:
    "Your request has been denied. Please contact your admin for more details. \n \n Regards, \n Team Livo",
  KEY: "signup request rejection",
};

const SIGNUP_REQUEST_APPROVED = {
  SUBJECT: "You are IN!",
  TEMPLATE:
    "Admin has approved your request. Please use your registered email and password to use the Livo App. \n \n Regards, \n Team Livo",
  KEY: "signup request approval",
};

const APP_FEATURES = {
  COMMUNITY: "communityManagement",
  SERVICE: "serviceManagement",
  VISITOR: "visitorManagement",
  DASHBOARD: "dashboard",
  INVOICE: "invoiceManagement",
};

const MAINTENANCE_REQUESTED_BY = {
  ADMIN: "Admin",
  RESIDENT: "Resident",
  OWNER: "Owner",
};

const STAFF_AVAILABILITY_STATUS = {
  AVAILABLE: "Available",
  UNAVAILABLE: "Unavailable",
  BOOKED: "Booked",
};

const FLAT_USAGE = {
  COMMERCIAL: "Commercial",
  RESIDENTIAL: "Residential",
  INDUSTRIAL: "Industrial",
};

const PAYMENT_FREQUENCIES = {
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  YEARLY: "Yearly",
  HALF_YEARLY: "Half Yearly",
};
const PAYMENT_FREQUENCY_VALUES = {
  Monthly: 1,
  Quarterly: 3,
  Yearly: 12,
  "Half Yearly": 6,
};

const DISCOUNT_APPLICABILITY = {
  DEPOSIT: "Deposit",
  INSTALLMENT: "Rent",
  GRACE: "Grace Period",
};

const GENDERS = {
  MALE: "Male",
  FEMALE: "Female",
  OTHERS: "Others",
};

const UTC_OFFSET = "+5:30";
const UAE_OFFSET = "+4:00";

const NOTICE_TARGET = {
  OWNER: "Owner",
  RESIDENT: "Resident",
};

const NOTICE_CATEGORIES = {
  EVENT: "Event",
  ANNOUNCEMENT: "Announcement",
};

const REQUEST_CANCEL_REASONS = {
  BY_MISTAKE: {
    reason_en: "Placed the request by mistake",
    reason_ar: "Placed the request by mistake ar",
    key: "BY_MISTAKE",
  },
  RAISED_OUTSIDE: {
    reason_en: "Appointed someone else from outside",
    reason_ar: "Appointed someone else from outside ar",
    key: "RAISED_OUTSIDE",
  },
  OTHER: {
    reason_en: "Other",
    reason_ar: "Other ar",
    key: "OTHER",
  },
};

const ASSET_CATEGORIES = {};

const ASSET_CONDITIONS = {
  WORKING: "Working",
  MAINTENANCE: "Maintenance",
  DECOMISSIONED: "Decomissioned",
};

const PPM_TYPES = {
  ASSET: "Asset",
  BUILDING: "Building",
  FLAT: "Flat",
};

const PPM_PRIORITIES = {
  NORMAL: "Normal",
  HIGH: "High",
  LOW: "Low",
};

const PPM_FREQUENCIES = {
  DAILY: "Daily",
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
  YEARLY: "Yearly",
};

const PPM_FREQUENCY_TYPES = {
  CUSTOM: "Custom",
  PATTERN: "Pattern",
};

const MONTHS = {
  1: "January",
  2: "February",
  3: "March",
  4: "April",
  5: "May",
  6: "June",
  7: "July",
  8: "August",
  9: "September",
  10: "October",
  11: "November",
  12: "December",
};

const WEEK_DAYS = {
  1: "Sunday",
  2: "Monday",
  3: "Tuesday",
  4: "Wednesday",
  5: "Thursday",
  6: "Friday",
  7: "Saturday",
};

const PROPERTY_INTERESTED_IN = {
  VILLA: "Villa",
  GARDEN_HOUSE: "Garden Houses",
  APARTMENT: "Apartment",
  RETAIL: "Retail",
  OTHERS: "Others",
};

const VIEWING_SOURCES = [
  { value: "Client with Channel Partner", id: 0 },
  { value: "Client with Sobha Connect", id: 1 },
  { value: "Self Initiative", id: 2 },
  { value: "Corporate", id: 3 },
  { value: "Loyalty Customer", id: 4 },
  { value: "Referral", id: 5 },
  { value: "Walk-in", id: 6 },
  // { value: "Marketing (Digital)", id: 7 },
  { value: "Others", id: 8 },
];

const PURCHASE_PURPOSES = {
  INVESTMENT: "Investment",
  END_USE: "End Use",
};

const INVENTORY_STATUSES = {
  ACTIVE: "Active",
  INACTIVE: "InActive",
};

const VISITING_STATUSES = {
  ACTIVE: "Active",
  INACTIVE: "InActive",
};

const INVENTORY_TYPES = {
  INVENTORY: "Inventory",
  NON_INVENTORY: "Non Inventory",
};

const UNIT_TYPES = {
  UNIT: "Unit",
  LITER: "Liter",
  CENTIMETER: "Centimeter",
  METER: "Meter",
  FEET: "Feet",
  YARD: "Yard",
  ROLL: "Roll",
  BOX: "Box",
  PACK: "pack",
  KILOGRAM: "Kilogram",
  LUMPSUM: "Lump Sum",
};

const BILLED_FOR = {
  ADMIN: "Admin",
  RESIDENT: "Resident",
  OWNER: "Owner",
};

const ADMIN_ACTION_TYPES = {
  NEW_REQUEST: {
    content_en: "%var% new request is raised",
    content_ar: "%var% new request is raised",
    key: "NEW_REQUEST",
  },
  DUE_REQUEST: {
    content_en: "%var% request is due",
    content_ar: "%var% request is due",
    key: "DUE_REQUEST",
  },
  DUE_LEASE: {
    content_en: "%var% lease is due",
    content_ar: "%var% lease is due",
    key: "DUE_LEASE",
  },
  BILL_PASSED_DUE_DATE: {
    content_en: "%var% bill passed it's due date",
    content_ar: "%var% bill passed it's due date",
    key: "BILL_PASSED_DUE_DATE",
  },
  NEW_LOGIN_REQUEST: {
    content_en: "%var% new login request",
    content_ar: "%var% new login request",
    key: "NEW_LOGIN_REQUEST",
  },
  SERVICE_REQUEST_OPEN_TO_ASSIGNEE: {
    content_en: "%var% service request status changed from open to assigned",
    content_ar: "%var% service request status changed from open to assigned",
    key: "SERVICE_REQUEST_OPEN_TO_ASSIGNEE",
  },
  SERVICE_REQUEST_OPEN_TO_INPROCESS: {
    content_en: "%var% service request status changed from open to in process",
    content_ar: "%var% service request status changed from open to in process",
    key: "SERVICE_REQUEST_OPEN_TO_INPROCESS",
  },
  SERVICE_REQUEST_INPROCESS_TO_COMPLETE: {
    content_en:
      "%var% service request status changed from in process to complete",
    content_ar:
      "%var% service request status changed from in process to complete",
    key: "SERVICE_REQUEST_INPROCESS_TO_COMPLETE",
  },
  SERVICE_REQUEST_COMPLETE_TO_REOPEN: {
    content_en: "%var% service request status changed from complete to reopen",
    content_ar: "%var% service request status changed from complete to reopen",
    key: "SERVICE_REQUEST_COMPLETE TO_REOPEN",
  },
  LEASE_RENEWAL_REQUEST: {
    content_en: "%var% new lease renewal request is raised",
    content_ar: "%var% new lease renewal request is raised",
    key: "LEASE_RENEWAL_REQUEST",
  },
};

const ADMIN_SOURCE_TYPES = {
  SERVICES: "services",
  LEASE: "lease",
  LOGIN_REQUEST: "login_request",
};

const FLAT_STATUSES = {
  OCCUPIED: "Occupied",
  VACANT: "Vacant",
};

const CONTRACT_STATUSES = {
  ACTIVE: "Active",
  IN_ACTIVE: "In-Active",
};

const NOTICE_STATUSES = {
  ACTIVE: "Active",
  IN_ACTIVE: "In-Active",
  FUTURE: "Future",
};

const GUARD_STATUSES = {
  ACTIVE: "Active",
  IN_ACTIVE: "In-Active",
};

const BIFURCATION_TYPE = {
  MAINTENANCE: "Maintenance",
  VISITOR: "Visitor",
  VISITOR_TRAFFIC: "Visitor-traffic",
};

const VISITOR_STATS_BIFURCATION_TYPES = {
  DAILY: "Daily",
  HOUR: "Hour",
  WEEK: "Week",
};

const RENTAL_TYPES = {
  MANAGED: "Managed",
  MIXED: "Mixed",
  LEASE: "Lease",
  OWNED: "Owned",
};

const COMPANY_TYPES = {
  LLC: "Limited Liability Company",
  FZC: "Free Zone Company",
  SP: "Sole Proprietorship",
  OC: "Offshore Company",
  PSC: "Private Shareholding Company",
  MC: "Mainland Company",
  PJSC: "Private Joint Stock Company",
  FCB: "Foreign Company Branch",
  GP: "General Partnership",
  JV: "Joint Venture",
  CC: "Civil Company",
  PC: "Partnership Company",
  OTHERS: "Others",
};

const LEASE_STATUSES = {
  DRAFT: "Draft",
  ACTIVE: "Active",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired",
  TERMINATED: "Terminated",
};

const PAYMENT_MODES = {
  CHEQUE: "Cheque",
  CASH: "Cash",
  ONLINE: "Online",
};

const DISCOUNT_TYPES = {
  FIXED: "Fixed",
  PERCENTAGE: "Percentage",
};

const LEASE_TARGETS = {
  FLAT: "Unit",
  SUB_FLAT: "Sub-Unit",
};

const LEASE_TYPES = {
  MANAGED: "Managed",
  MIXED: "Mixed",
  LEASED: "Leased",
  OWNED: "Owned",
};

const LEASE_RENTAL_TYPES = {
  SHORT_TERM: "Short Term",
  LONG_TERM: "Long Term",
};
const MASTER_USER_TYPES = {
  OWNER: "Owner",
  RESIDENT: "Resident",
  RESIDENT_OWNER: "Resident Owner",
  NEW_USER: "New User",
};

const WALK_IN_SOURCES = {
  DIGITAL: "Digital",
  CHANNEL_PARTNER: "Channel Partner",
  SOBHA_CONNECT: "Sobha Connect",
  CHAIRMAN_REFERENCE: "Chairman Reference",
  MANAGEMENT_REFERENCE: "Management Reference",
  EMPLOYEE_REFERENCE: "Employee Reference",
  MARKETING: "Marketing",
  ROADSHOW: "Roadshow",
  LOYALTY_CUSTOMER: "Loyalty Customer",
  LOYALTY_CUSTOMER_REFERRAL: "Loyalty Customer Referral",
  RETENTION: "Retention",
  EMPLOYEE: "Employee",
  STAND_LEADS: "Stand Leads",
  WALK_IN: "Walk-in",
  MANAGEMENT_REFERRAL: "Management Referral",
  EMPLOYEE_REFERRAL: "Employee Referral",
  SALESPERSON_INITIATIVE: "Salesperson Initiative",
  Other: "Others",
};

const INDICATIVE_BUDGET = {
  RANGE_1: "0.7 Mil – 1.5 Mil",
  RANGE_2: "1.5 Mil – 3 Mil",
  RANGE_3: "3 Mil – 5.5 Mil",
  RANGE_4: "5.5 Mil – 8 Mil",
  RANGE_5: "8 Mil – 12.5 Mil",
  RANGE_6: "12.5 Mil & above",
};

const POSSESSION_TIMELINE = {
  RTMI: "Ready to Move in (RTMI)",
  // RTLI: "Ready to Live In (RTLI)",
  UC_1_TO_2_YEARS: "Under Construction (UC – 1 to 2 years)",
  UC_2_TO_3_YEARS: "Under Construction (UC – 2 to 3 years)",
  UC_MORE_THAN_3_YEARS: "Under Construction (UC – More than 3 years)",
};

const PROPERTY_TYPE = {
  VILLA: "Villa",
  APARTMENT: "Apartment",
  RETAIL: "Retail",
};

const PRODUCTS = {
  ST: "ST",
  ONE_BR: "1 BR",
  TWO_BR: "2 BR",
  THREE_BR: "3 BR",
  TWO_DP: "2DP",
  THREE_DP: "3DP",
  FOUR_DP: "4DP",
  FOUR_BR_VILLA: "4BR Villa",
  FIVE_BR_VILLA: "5BR Villa",
  GFA_PLOTS: "GFA Plots",
  GARDENIA: "Gardenia",
  TOWNHOUSE: "Townhouse",
  RETAIL: "Retail",
  RESTAURANT: "Restaurant",
  CANAL_VILLA: "Canal Villa",
};

const SCHEDULING_TYPES = {
  E_MAIL: "E_MAIL",
  SMS: "SMS",
  BOTH: "BOTH",
};

const LEASE_REMINDER_STATUSES = {
  PENDING: "Pending",
  SENT: "Sent",
};

const TOKEN_EXPIRY_TIMES = {
  development: {
    ACCESS_TOKEN_EXPIRY_TIME: "1d",
    REFRESH_TOKEN_EXPIRY_TIME: "3d",
    TIME_EXPIRY_SECONDS: 60 * 60 * 24,
  },
  staging: {
    ACCESS_TOKEN_EXPIRY_TIME: "30d",
    REFRESH_TOKEN_EXPIRY_TIME: "60d",
    TIME_EXPIRY_SECONDS: 60 * 60 * 24 * 30,
  },
  production: {
    ACCESS_TOKEN_EXPIRY_TIME: "60d",
    REFRESH_TOKEN_EXPIRY_TIME: "90d",
    TIME_EXPIRY_SECONDS: 60 * 60 * 24 * 60,
  },
};
const AMENITIES_FOR = {
  FLATS: "Flats",
  PROPERTIES: "Properties",
};

const SIDEBAR_VALUES = {
  DASHBOARD: "Dashboard",
  MY_PROPERTIES: "My Properties",
  SERVICES: "Services",
  LEASE_MANAGEMENT: "Lease Management",
  VISITOR_MANAGEMENT: "Visitor Management",
  GUARD_MANAGEMENT: "Guard Management",
  LOGIN_REQUESTS: "Login Requests",
  NOTICES: "Notices",
  HELPLINE: "Helpline",
  CONFIGURATION: "Configuration",
};

const clientIdentificationValues = {
  UUID: 'uuid',
  EMAIL: 'email',
  MOBILE_NUMBER: 'mobileNumber'
}

module.exports = {
  LANGUAGES,
  VISITOR_STATUSES,
  TIMEZONES,
  COMMON_DATE_FORMAT,
  USER_TYPES,
  ACTION_TYPES,
  SOURCE_TYPES,
  DEVICE_TYPES,
  TARGET_AUDIENCE,
  VISITOR_CATEGORIES,
  ITEM_CONDITIONS,
  RENEWAL_PERIOD_TYPE,
  ITEM_CATEGORIES,
  CURRENCY,
  MAINTENANCE_STATUSES,
  MAINTENANCE_TYPES,
  PIXLAB_DOCUMENT_TYPES,
  PIXLAB_SUPPORTED_COUNTRIES,
  CHARGE_TYPES,
  PAYMENT_STATUSES,
  ADMIN_ROLES,
  USER_ROLES,
  BUILDING_TYPES,
  FLAT_SIZES,
  APPOINTMENT_TYPES,
  DESIGNATION_TYPES,
  DEPARTMENT_TYPES,
  CHARGE_CATEGORIES,
  SERVICE_TAX,
  REPORT_REASONS,
  PASSWORD_CHANGED_TEMPLATE,
  SIGNUP_REQUEST_REJECTED,
  SIGNUP_REQUEST_APPROVED,
  APP_FEATURES,
  DATE_FORMAT,
  TIME_FORMAT,
  MAINTENANCE_REQUESTED_BY,
  STAFF_AVAILABILITY_STATUS,
  FLAT_TYPES,
  FLAT_FURNISHINGS,
  FLAT_USAGE,
  PAYMENT_FREQUENCIES,
  DISCOUNT_APPLICABILITY,
  GENDERS,
  UTC_OFFSET,
  NOTICE_TARGET,
  NOTICE_CATEGORIES,
  UAE_OFFSET,
  REQUEST_CANCEL_REASONS,
  ENVIRONMENTS,
  ASSET_CATEGORIES,
  ASSET_CONDITIONS,
  PPM_TYPES,
  PPM_PRIORITIES,
  PPM_FREQUENCIES,
  PPM_FREQUENCY_TYPES,
  MONTHS,
  WEEK_DAYS,
  PROPERTY_INTERESTED_IN,
  VIEWING_SOURCES,
  PURCHASE_PURPOSES,
  PAYMENT_FREQUENCY_VALUES,
  INVENTORY_STATUSES,
  UNIT_TYPES,
  BILLED_FOR,
  ADMIN_ACTION_TYPES,
  ADMIN_SOURCE_TYPES,
  FLAT_STATUSES,
  CONTRACT_STATUSES,
  NOTICE_STATUSES,
  GUARD_STATUSES,
  BIFURCATION_TYPE,
  RENTAL_TYPES,
  COMPANY_TYPES,
  LEASE_STATUSES,
  PAYMENT_MODES,
  DISCOUNT_TYPES,
  LEASE_TARGETS,
  MASTER_USER_TYPES,
  WALK_IN_SOURCES,
  INDICATIVE_BUDGET,
  POSSESSION_TIMELINE,
  PROPERTY_TYPE,
  PRODUCTS,
  LEASE_RENTAL_TYPES,
  LEASE_TYPES,
  SCHEDULING_TYPES,
  TOKEN_EXPIRY_TIMES,
  LEASE_REMINDER_STATUSES,
  AMENITIES_FOR,
  USER_FILTERS,
  INVENTORY_TYPES,
  INVOICE_TYPES,
  INVOICE_PAYMENT_STATUSES,
  INVOICE_FOR,
  VISITING_STATUSES,
  SIDEBAR_VALUES,
  VISITOR_STATS_BIFURCATION_TYPES,
  clientIdentificationValues
};
