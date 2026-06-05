-- Platform super-user role (cross-tenant; distinct from tenant OPERATOR_ADMIN)
ALTER TYPE "StaffRole" ADD VALUE 'PLATFORM_ADMIN' BEFORE 'OPERATOR_ADMIN';
