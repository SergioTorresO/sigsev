CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS postgis;

-- CreateEnum
CREATE TYPE "maintenance_status" AS ENUM ('PENDIENTE', 'EN_PROCESO', 'COMPLETADO');

-- CreateEnum
CREATE TYPE "signal_status" AS ENUM ('BUENO', 'REGULAR', 'DETERIORADO', 'CAIDO', 'DESAPARECIDO');

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('ADMIN', 'SUPERVISOR', 'TECNICO', 'CONSULTA');

-- CreateEnum
CREATE TYPE "zone_type" AS ENUM ('URBANA', 'RURAL');

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID,
    "action" VARCHAR(100),
    "table_name" VARCHAR(100),
    "record_id" UUID,
    "old_data" JSONB,
    "new_data" JSONB,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidences" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "signal_id" UUID,
    "inspection_id" UUID,
    "uploaded_by" UUID,
    "image_url" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inspections" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "signal_id" UUID,
    "technician_id" UUID,
    "inspection_date" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "status" "signal_status",
    "observations" TEXT,
    "evidence_image" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inspections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenances" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "signal_id" UUID,
    "assigned_to" UUID,
    "status" "maintenance_status" DEFAULT 'PENDIENTE',
    "description" TEXT,
    "cost" DECIMAL(12,2),
    "maintenance_date" DATE,
    "completed_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "maintenances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "municipalities" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" VARCHAR(120) NOT NULL,
    "department" VARCHAR(120),
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "municipalities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID,
    "title" VARCHAR(255),
    "message" TEXT,
    "is_read" BOOLEAN DEFAULT false,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signal_categories" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "signal_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signal_types" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "category_id" UUID,
    "name" VARCHAR(100) NOT NULL,
    "code" VARCHAR(50),
    "description" TEXT,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "signal_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signals" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "signal_code" VARCHAR(100) NOT NULL,
    "category_id" UUID,
    "signal_type_id" UUID,
    "municipality_id" UUID,
    "zone_id" UUID,
    "installed_by" UUID,
    "status" "signal_status" DEFAULT 'BUENO',
    "address" TEXT,
    "description" TEXT,
    "observations" TEXT,
    "installation_date" DATE,
    "last_maintenance_date" DATE,
    "image_url" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "geom" geography,
    "is_active" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "signals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "role_id" UUID,
    "full_name" VARCHAR(150) NOT NULL,
    "email" VARCHAR(150) NOT NULL,
    "password" TEXT NOT NULL,
    "phone" VARCHAR(30),
    "is_active" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zones" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "municipality_id" UUID,
    "name" VARCHAR(120) NOT NULL,
    "zone_type" "zone_type" NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "zones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_inspections_signal" ON "inspections"("signal_id");

-- CreateIndex
CREATE INDEX "idx_maintenances_signal" ON "maintenances"("signal_id");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "signals_signal_code_key" ON "signals"("signal_code");

-- CreateIndex
CREATE INDEX "idx_signals_geom" ON "signals" USING GIST ("geom");

-- CreateIndex
CREATE INDEX "idx_signals_status" ON "signals"("status");

-- CreateIndex
CREATE INDEX "idx_signals_zone" ON "signals"("zone_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "evidences" ADD CONSTRAINT "evidences_inspection_id_fkey" FOREIGN KEY ("inspection_id") REFERENCES "inspections"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "evidences" ADD CONSTRAINT "evidences_signal_id_fkey" FOREIGN KEY ("signal_id") REFERENCES "signals"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "evidences" ADD CONSTRAINT "evidences_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_signal_id_fkey" FOREIGN KEY ("signal_id") REFERENCES "signals"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "maintenances" ADD CONSTRAINT "maintenances_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "maintenances" ADD CONSTRAINT "maintenances_signal_id_fkey" FOREIGN KEY ("signal_id") REFERENCES "signals"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "signal_types" ADD CONSTRAINT "signal_types_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "signal_categories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "signals" ADD CONSTRAINT "signals_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "signal_categories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "signals" ADD CONSTRAINT "signals_installed_by_fkey" FOREIGN KEY ("installed_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "signals" ADD CONSTRAINT "signals_municipality_id_fkey" FOREIGN KEY ("municipality_id") REFERENCES "municipalities"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "signals" ADD CONSTRAINT "signals_signal_type_id_fkey" FOREIGN KEY ("signal_type_id") REFERENCES "signal_types"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "signals" ADD CONSTRAINT "signals_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "zones"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "zones" ADD CONSTRAINT "zones_municipality_id_fkey" FOREIGN KEY ("municipality_id") REFERENCES "municipalities"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
