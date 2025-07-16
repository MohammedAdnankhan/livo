CREATE TABLE tenants (
    tenant_id VARCHAR(255) PRIMARY KEY, -- Unique identifier for the tenant
    tenant_name VARCHAR(255) NOT NULL, -- Business name of the tenant
    admin_user_email VARCHAR(255) NOT NULL, -- Primary admin user email
    admin_user_password VARCHAR(255) NOT NULL, -- Primary admin user password
    contact_email VARCHAR(255) NOT NULL, -- Official contact email
    contact_number VARCHAR(50), -- Number
    industry VARCHAR(255), -- Optional categorization (e.g., Real Estate, Hospitality, IT)
    modules_enabled VARCHAR(255), -- Leasing / FM / Visitor Management (comma-separated or JSON)
    status VARCHAR(20) NOT NULL, -- Active / Inactive
    notes TEXT -- Internal comments (optional)
); 