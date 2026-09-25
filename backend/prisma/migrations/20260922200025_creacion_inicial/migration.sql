-- CreateTable
CREATE TABLE "articles" (
    "article_id" SERIAL NOT NULL,
    "category_id" INTEGER NOT NULL,
    "article_code" VARCHAR(50) NOT NULL,
    "article_number" VARCHAR(50),
    "article_name" VARCHAR(150) NOT NULL,
    "article_compound_name" VARCHAR(200),
    "article_description" VARCHAR(255),
    "article_unit_of_measure" VARCHAR(20) NOT NULL DEFAULT 'UNIDAD',
    "article_stock_min_general" INTEGER NOT NULL DEFAULT 0,
    "article_state" BOOLEAN NOT NULL DEFAULT true,
    "creation_date" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "articles_pkey" PRIMARY KEY ("article_id")
);

-- CreateTable
CREATE TABLE "articles_deposit_stock" (
    "stock_id" SERIAL NOT NULL,
    "article_id" INTEGER NOT NULL,
    "deposit_id" INTEGER NOT NULL,
    "stock_amount" INTEGER NOT NULL DEFAULT 0,
    "update_date" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "articles_deposit_stock_pkey" PRIMARY KEY ("stock_id")
);

-- CreateTable
CREATE TABLE "categories" (
    "category_id" SERIAL NOT NULL,
    "category_name" VARCHAR(100) NOT NULL,
    "category_description" VARCHAR(200),
    "category_state" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("category_id")
);

-- CreateTable
CREATE TABLE "deposit" (
    "deposit_id" SERIAL NOT NULL,
    "deposit_name" VARCHAR(100) NOT NULL,
    "deposit_location" VARCHAR(150),
    "deposit_state" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "deposit_pkey" PRIMARY KEY ("deposit_id")
);

-- CreateTable
CREATE TABLE "employees" (
    "employees_id" SERIAL NOT NULL,
    "rol_id" INTEGER NOT NULL,
    "employees_name" VARCHAR(100) NOT NULL,
    "employees_lastname" VARCHAR(100) NOT NULL,
    "employees_email" VARCHAR(150) NOT NULL,
    "employees_phone" VARCHAR(30) NOT NULL,
    "employees_state" BOOLEAN NOT NULL DEFAULT true,
    "creation_date" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("employees_id")
);

-- CreateTable
CREATE TABLE "movement_type" (
    "movement_type_id" SERIAL NOT NULL,
    "movement_type" VARCHAR(50) NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "effect" VARCHAR(20) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "movement_type_pkey" PRIMARY KEY ("movement_type_id")
);

-- CreateTable
CREATE TABLE "movement_stock_detail" (
    "detail_id" SERIAL NOT NULL,
    "stock_movement_id" INTEGER NOT NULL,
    "stock_id" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,

    CONSTRAINT "movement_stock_detail_pkey" PRIMARY KEY ("detail_id")
);

-- CreateTable
CREATE TABLE "roles" (
    "rol_id" SERIAL NOT NULL,
    "rol_name" VARCHAR(50) NOT NULL,
    "rol_pass" TEXT NOT NULL,
    "rol_description" VARCHAR(255),
    "rol_state" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("rol_id")
);

-- CreateTable
CREATE TABLE "stock_movement" (
    "stock_movement_id" SERIAL NOT NULL,
    "movement_type_id" INTEGER NOT NULL,
    "deposit_origin_id" INTEGER,
    "deposit_destination_id" INTEGER,
    "employees_id" INTEGER NOT NULL,
    "supplier_id" INTEGER,
    "observations" VARCHAR(255),
    "transaction_date" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movement_pkey" PRIMARY KEY ("stock_movement_id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "supplier_id" SERIAL NOT NULL,
    "supplier_legal_name" VARCHAR(150) NOT NULL,
    "supplier_trade_name" VARCHAR(150),
    "supplier_cuit" VARCHAR(13) NOT NULL,
    "supplier_email" VARCHAR(150),
    "supplier_phone" VARCHAR(30),
    "supplier_address" VARCHAR(200),
    "supplier_state" BOOLEAN NOT NULL DEFAULT true,
    "tax_condition_id" INTEGER,
    "creation_date" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("supplier_id")
);

-- CreateTable
CREATE TABLE "voucher_type" (
    "voucher_type_id" SERIAL NOT NULL,
    "voucher_type" VARCHAR(50) NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "sign" SMALLINT NOT NULL,
    "affects_account" BOOLEAN NOT NULL DEFAULT true,
    "is_payable" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "voucher_type_pkey" PRIMARY KEY ("voucher_type_id")
);

-- CreateTable
CREATE TABLE "supplier_voucher" (
    "voucher_id" SERIAL NOT NULL,
    "supplier_id" INTEGER NOT NULL,
    "voucher_type_id" INTEGER NOT NULL,
    "voucher_point_of_sale" VARCHAR(5) NOT NULL DEFAULT '0001',
    "voucher_number" VARCHAR(20) NOT NULL,
    "issue_date" DATE NOT NULL,
    "due_date" DATE,
    "reception_date" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "total_amount" DECIMAL(14,2) NOT NULL,
    "paid_amount" DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    "voucher_status" VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
    "observations" VARCHAR(255),
    "employees_id" INTEGER NOT NULL,
    "purchase_order_id" INTEGER,
    "creation_date" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "annulled_date" TIMESTAMPTZ(6),
    "annulled_reason" VARCHAR(255),

    CONSTRAINT "supplier_voucher_pkey" PRIMARY KEY ("voucher_id")
);

-- CreateTable
CREATE TABLE "payment_method" (
    "payment_method_id" SERIAL NOT NULL,
    "payment_method" VARCHAR(50) NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "requires_reference" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "payment_method_pkey" PRIMARY KEY ("payment_method_id")
);

-- CreateTable
CREATE TABLE "payment_order" (
    "payment_order_id" SERIAL NOT NULL,
    "supplier_id" INTEGER NOT NULL,
    "payment_method_id" INTEGER NOT NULL,
    "payment_date" DATE NOT NULL,
    "total_amount" DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    "payment_reference" VARCHAR(100),
    "payment_order_status" SMALLINT NOT NULL DEFAULT 0,
    "observations" VARCHAR(255),
    "employees_id" INTEGER NOT NULL,
    "creation_date" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmed_date" TIMESTAMPTZ(6),

    CONSTRAINT "payment_order_pkey" PRIMARY KEY ("payment_order_id")
);

-- CreateTable
CREATE TABLE "payment_order_detail" (
    "detail_id" SERIAL NOT NULL,
    "payment_order_id" INTEGER NOT NULL,
    "voucher_id" INTEGER NOT NULL,
    "applied_amount" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "payment_order_detail_pkey" PRIMARY KEY ("detail_id")
);

-- CreateTable
CREATE TABLE "payment_order_reset" (
    "reset_id" SERIAL NOT NULL,
    "payment_order_id" INTEGER NOT NULL,
    "employees_id" INTEGER NOT NULL,
    "reset_date" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "restored_amount" DECIMAL(14,2) NOT NULL,
    "reset_reason" VARCHAR(255) NOT NULL,

    CONSTRAINT "payment_order_reset_pkey" PRIMARY KEY ("reset_id")
);

-- CreateTable
CREATE TABLE "supplier_account_movement" (
    "account_movement_id" SERIAL NOT NULL,
    "supplier_id" INTEGER NOT NULL,
    "movement_date" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "concept" VARCHAR(150) NOT NULL,
    "debit" DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    "credit" DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    "voucher_id" INTEGER,
    "payment_order_id" INTEGER,
    "reversal_of_movement_id" INTEGER,
    "employees_id" INTEGER NOT NULL,
    "creation_date" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_account_movement_pkey" PRIMARY KEY ("account_movement_id")
);

-- CreateTable
CREATE TABLE "expense_category" (
    "expense_category_id" SERIAL NOT NULL,
    "expense_category_name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(255),
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "expense_category_pkey" PRIMARY KEY ("expense_category_id")
);

-- CreateTable
CREATE TABLE "expense" (
    "expense_id" SERIAL NOT NULL,
    "expense_category_id" INTEGER NOT NULL,
    "supplier_id" INTEGER,
    "expense_date" DATE NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "expense_status" VARCHAR(20) NOT NULL DEFAULT 'REGISTRADO',
    "employees_id" INTEGER NOT NULL,
    "creation_date" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expense_pkey" PRIMARY KEY ("expense_id")
);

-- CreateTable
CREATE TABLE "expense_voucher" (
    "expense_voucher_id" SERIAL NOT NULL,
    "expense_id" INTEGER NOT NULL,
    "voucher_id" INTEGER NOT NULL,
    "allocated_amount" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "expense_voucher_pkey" PRIMARY KEY ("expense_voucher_id")
);

-- CreateTable
CREATE TABLE "expense_payment_order" (
    "expense_payment_id" SERIAL NOT NULL,
    "expense_id" INTEGER NOT NULL,
    "payment_order_id" INTEGER NOT NULL,

    CONSTRAINT "expense_payment_order_pkey" PRIMARY KEY ("expense_payment_id")
);

-- CreateTable
CREATE TABLE "tax_condition" (
    "tax_condition_id" SERIAL NOT NULL,
    "tax_condition_name" VARCHAR(60) NOT NULL,
    "description" VARCHAR(200),
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "tax_condition_pkey" PRIMARY KEY ("tax_condition_id")
);

-- CreateTable
CREATE TABLE "purchase_order" (
    "purchase_order_id" SERIAL NOT NULL,
    "purchase_order_number" VARCHAR(20) NOT NULL,
    "supplier_id" INTEGER NOT NULL,
    "issue_date" DATE NOT NULL,
    "expected_date" DATE,
    "purchase_conditions" VARCHAR(255),
    "purchase_order_status" VARCHAR(20) NOT NULL DEFAULT 'BORRADOR',
    "total_amount" DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    "observations" VARCHAR(255),
    "employees_id" INTEGER NOT NULL,
    "creation_date" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_order_pkey" PRIMARY KEY ("purchase_order_id")
);

-- CreateTable
CREATE TABLE "purchase_order_detail" (
    "purchase_detail_id" SERIAL NOT NULL,
    "purchase_order_id" INTEGER NOT NULL,
    "article_id" INTEGER,
    "item_description" VARCHAR(255) NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL,
    "unit_price" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "purchase_order_detail_pkey" PRIMARY KEY ("purchase_detail_id")
);

-- CreateTable
CREATE TABLE "purchase_order_status_history" (
    "status_history_id" SERIAL NOT NULL,
    "purchase_order_id" INTEGER NOT NULL,
    "previous_status" VARCHAR(20),
    "new_status" VARCHAR(20) NOT NULL,
    "changed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "employees_id" INTEGER NOT NULL,
    "reason" VARCHAR(255),

    CONSTRAINT "purchase_order_status_history_pkey" PRIMARY KEY ("status_history_id")
);

-- CreateTable
CREATE TABLE "room_type" (
    "room_type_id" SERIAL NOT NULL,
    "room_type_name" VARCHAR(60) NOT NULL,
    "description" VARCHAR(255),
    "max_capacity" SMALLINT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "room_type_pkey" PRIMARY KEY ("room_type_id")
);

-- CreateTable
CREATE TABLE "room" (
    "room_id" SERIAL NOT NULL,
    "room_number" VARCHAR(10) NOT NULL,
    "room_type_id" INTEGER NOT NULL,
    "room_status" VARCHAR(20) NOT NULL DEFAULT 'DISPONIBLE',

    CONSTRAINT "room_pkey" PRIMARY KEY ("room_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "articles_article_code_key" ON "articles"("article_code");

-- CreateIndex
CREATE INDEX "idx_articles_category" ON "articles"("category_id");

-- CreateIndex
CREATE INDEX "idx_stock_deposit" ON "articles_deposit_stock"("deposit_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_article_deposit" ON "articles_deposit_stock"("article_id", "deposit_id");

-- CreateIndex
CREATE UNIQUE INDEX "categories_category_name_key" ON "categories"("category_name");

-- CreateIndex
CREATE UNIQUE INDEX "deposit_deposit_name_key" ON "deposit"("deposit_name");

-- CreateIndex
CREATE UNIQUE INDEX "employees_employees_email_key" ON "employees"("employees_email");

-- CreateIndex
CREATE INDEX "idx_employees_rol" ON "employees"("rol_id");

-- CreateIndex
CREATE UNIQUE INDEX "movement_type_movement_type_key" ON "movement_type"("movement_type");

-- CreateIndex
CREATE INDEX "idx_detail_stock" ON "movement_stock_detail"("stock_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_movement_stock" ON "movement_stock_detail"("stock_movement_id", "stock_id");

-- CreateIndex
CREATE UNIQUE INDEX "roles_rol_name_key" ON "roles"("rol_name");

-- CreateIndex
CREATE INDEX "idx_movement_date" ON "stock_movement"("transaction_date");

-- CreateIndex
CREATE INDEX "idx_movement_origin" ON "stock_movement"("deposit_origin_id");

-- CreateIndex
CREATE INDEX "idx_movement_destination" ON "stock_movement"("deposit_destination_id");

-- CreateIndex
CREATE INDEX "idx_movement_type" ON "stock_movement"("movement_type_id");

-- CreateIndex
CREATE INDEX "idx_movement_employees" ON "stock_movement"("employees_id");

-- CreateIndex
CREATE INDEX "idx_movement_supplier" ON "stock_movement"("supplier_id");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_supplier_cuit_key" ON "suppliers"("supplier_cuit");

-- CreateIndex
CREATE UNIQUE INDEX "voucher_type_voucher_type_key" ON "voucher_type"("voucher_type");

-- CreateIndex
CREATE INDEX "idx_voucher_supplier" ON "supplier_voucher"("supplier_id");

-- CreateIndex
CREATE INDEX "idx_voucher_type" ON "supplier_voucher"("voucher_type_id");

-- CreateIndex
CREATE INDEX "idx_voucher_status" ON "supplier_voucher"("voucher_status");

-- CreateIndex
CREATE INDEX "idx_voucher_issue_date" ON "supplier_voucher"("issue_date");

-- CreateIndex
CREATE INDEX "idx_voucher_employees" ON "supplier_voucher"("employees_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_voucher_supplier_number" ON "supplier_voucher"("supplier_id", "voucher_type_id", "voucher_point_of_sale", "voucher_number");

-- CreateIndex
CREATE UNIQUE INDEX "payment_method_payment_method_key" ON "payment_method"("payment_method");

-- CreateIndex
CREATE INDEX "idx_payment_order_supplier" ON "payment_order"("supplier_id");

-- CreateIndex
CREATE INDEX "idx_payment_order_date" ON "payment_order"("payment_date");

-- CreateIndex
CREATE INDEX "idx_payment_order_status" ON "payment_order"("payment_order_status");

-- CreateIndex
CREATE INDEX "idx_payment_order_method" ON "payment_order"("payment_method_id");

-- CreateIndex
CREATE INDEX "idx_payment_detail_voucher" ON "payment_order_detail"("voucher_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_payment_order_voucher" ON "payment_order_detail"("payment_order_id", "voucher_id");

-- CreateIndex
CREATE INDEX "idx_reset_payment_order" ON "payment_order_reset"("payment_order_id");

-- CreateIndex
CREATE INDEX "idx_account_supplier" ON "supplier_account_movement"("supplier_id", "movement_date");

-- CreateIndex
CREATE INDEX "idx_account_voucher" ON "supplier_account_movement"("voucher_id");

-- CreateIndex
CREATE INDEX "idx_account_payment_order" ON "supplier_account_movement"("payment_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "expense_category_expense_category_name_key" ON "expense_category"("expense_category_name");

-- CreateIndex
CREATE INDEX "idx_expense_category" ON "expense"("expense_category_id");

-- CreateIndex
CREATE INDEX "idx_expense_supplier" ON "expense"("supplier_id");

-- CreateIndex
CREATE INDEX "idx_expense_date" ON "expense"("expense_date");

-- CreateIndex
CREATE INDEX "idx_expense_voucher_voucher" ON "expense_voucher"("voucher_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_expense_voucher" ON "expense_voucher"("expense_id", "voucher_id");

-- CreateIndex
CREATE INDEX "idx_expense_payment_order" ON "expense_payment_order"("payment_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_expense_payment_order" ON "expense_payment_order"("expense_id", "payment_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "tax_condition_tax_condition_name_key" ON "tax_condition"("tax_condition_name");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_order_purchase_order_number_key" ON "purchase_order"("purchase_order_number");

-- CreateIndex
CREATE INDEX "idx_purchase_order_supplier" ON "purchase_order"("supplier_id");

-- CreateIndex
CREATE INDEX "idx_purchase_order_status" ON "purchase_order"("purchase_order_status");

-- CreateIndex
CREATE INDEX "idx_purchase_order_date" ON "purchase_order"("issue_date");

-- CreateIndex
CREATE INDEX "idx_purchase_order_employee" ON "purchase_order"("employees_id");

-- CreateIndex
CREATE INDEX "idx_purchase_detail_order" ON "purchase_order_detail"("purchase_order_id");

-- CreateIndex
CREATE INDEX "idx_purchase_detail_article" ON "purchase_order_detail"("article_id");

-- CreateIndex
CREATE INDEX "idx_status_history_order" ON "purchase_order_status_history"("purchase_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "room_type_room_type_name_key" ON "room_type"("room_type_name");

-- CreateIndex
CREATE UNIQUE INDEX "room_room_number_key" ON "room"("room_number");

-- CreateIndex
CREATE INDEX "idx_room_type" ON "room"("room_type_id");

-- CreateIndex
CREATE INDEX "idx_room_status" ON "room"("room_status");

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "fk_article_categories" FOREIGN KEY ("category_id") REFERENCES "categories"("category_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "articles_deposit_stock" ADD CONSTRAINT "fk_stock_article" FOREIGN KEY ("article_id") REFERENCES "articles"("article_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "articles_deposit_stock" ADD CONSTRAINT "fk_stock_deposit" FOREIGN KEY ("deposit_id") REFERENCES "deposit"("deposit_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "fk_employees_rol" FOREIGN KEY ("rol_id") REFERENCES "roles"("rol_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "movement_stock_detail" ADD CONSTRAINT "fk_detail_movement" FOREIGN KEY ("stock_movement_id") REFERENCES "stock_movement"("stock_movement_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "movement_stock_detail" ADD CONSTRAINT "fk_detail_stock" FOREIGN KEY ("stock_id") REFERENCES "articles_deposit_stock"("stock_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "stock_movement" ADD CONSTRAINT "fk_stock_movement_type" FOREIGN KEY ("movement_type_id") REFERENCES "movement_type"("movement_type_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "stock_movement" ADD CONSTRAINT "fk_movement_employees" FOREIGN KEY ("employees_id") REFERENCES "employees"("employees_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "stock_movement" ADD CONSTRAINT "fk_movement_supplier" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("supplier_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "stock_movement" ADD CONSTRAINT "fk_stock_movement_origin" FOREIGN KEY ("deposit_origin_id") REFERENCES "deposit"("deposit_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "stock_movement" ADD CONSTRAINT "fk_stock_movement_destination" FOREIGN KEY ("deposit_destination_id") REFERENCES "deposit"("deposit_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "fk_supplier_tax_condition" FOREIGN KEY ("tax_condition_id") REFERENCES "tax_condition"("tax_condition_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "supplier_voucher" ADD CONSTRAINT "fk_voucher_supplier" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("supplier_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "supplier_voucher" ADD CONSTRAINT "fk_voucher_purchase_order" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_order"("purchase_order_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "supplier_voucher" ADD CONSTRAINT "fk_voucher_type" FOREIGN KEY ("voucher_type_id") REFERENCES "voucher_type"("voucher_type_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "supplier_voucher" ADD CONSTRAINT "fk_voucher_employees" FOREIGN KEY ("employees_id") REFERENCES "employees"("employees_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "payment_order" ADD CONSTRAINT "fk_payment_order_supplier" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("supplier_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "payment_order" ADD CONSTRAINT "fk_payment_order_method" FOREIGN KEY ("payment_method_id") REFERENCES "payment_method"("payment_method_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "payment_order" ADD CONSTRAINT "fk_payment_order_employee" FOREIGN KEY ("employees_id") REFERENCES "employees"("employees_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "payment_order_detail" ADD CONSTRAINT "fk_detail_payment_order" FOREIGN KEY ("payment_order_id") REFERENCES "payment_order"("payment_order_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "payment_order_detail" ADD CONSTRAINT "fk_detail_voucher" FOREIGN KEY ("voucher_id") REFERENCES "supplier_voucher"("voucher_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "payment_order_reset" ADD CONSTRAINT "fk_reset_payment_order" FOREIGN KEY ("payment_order_id") REFERENCES "payment_order"("payment_order_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "payment_order_reset" ADD CONSTRAINT "fk_reset_employee" FOREIGN KEY ("employees_id") REFERENCES "employees"("employees_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "supplier_account_movement" ADD CONSTRAINT "fk_account_supplier" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("supplier_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "supplier_account_movement" ADD CONSTRAINT "fk_account_voucher" FOREIGN KEY ("voucher_id") REFERENCES "supplier_voucher"("voucher_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "supplier_account_movement" ADD CONSTRAINT "fk_account_payment_order" FOREIGN KEY ("payment_order_id") REFERENCES "payment_order"("payment_order_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "supplier_account_movement" ADD CONSTRAINT "fk_account_reversal" FOREIGN KEY ("reversal_of_movement_id") REFERENCES "supplier_account_movement"("account_movement_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "supplier_account_movement" ADD CONSTRAINT "fk_account_employee" FOREIGN KEY ("employees_id") REFERENCES "employees"("employees_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "expense" ADD CONSTRAINT "fk_expense_category" FOREIGN KEY ("expense_category_id") REFERENCES "expense_category"("expense_category_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "expense" ADD CONSTRAINT "fk_expense_supplier" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("supplier_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "expense" ADD CONSTRAINT "fk_expense_employee" FOREIGN KEY ("employees_id") REFERENCES "employees"("employees_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "expense_voucher" ADD CONSTRAINT "fk_expense_voucher_expense" FOREIGN KEY ("expense_id") REFERENCES "expense"("expense_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "expense_voucher" ADD CONSTRAINT "fk_expense_voucher_voucher" FOREIGN KEY ("voucher_id") REFERENCES "supplier_voucher"("voucher_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "expense_payment_order" ADD CONSTRAINT "fk_expense_payment_expense" FOREIGN KEY ("expense_id") REFERENCES "expense"("expense_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "expense_payment_order" ADD CONSTRAINT "fk_expense_payment_order" FOREIGN KEY ("payment_order_id") REFERENCES "payment_order"("payment_order_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "purchase_order" ADD CONSTRAINT "fk_purchase_order_supplier" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("supplier_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "purchase_order" ADD CONSTRAINT "fk_purchase_order_employee" FOREIGN KEY ("employees_id") REFERENCES "employees"("employees_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "purchase_order_detail" ADD CONSTRAINT "fk_purchase_detail_order" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_order"("purchase_order_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "purchase_order_detail" ADD CONSTRAINT "fk_purchase_detail_article" FOREIGN KEY ("article_id") REFERENCES "articles"("article_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "purchase_order_status_history" ADD CONSTRAINT "fk_status_history_order" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_order"("purchase_order_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "purchase_order_status_history" ADD CONSTRAINT "fk_status_history_employee" FOREIGN KEY ("employees_id") REFERENCES "employees"("employees_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "room" ADD CONSTRAINT "fk_room_type" FOREIGN KEY ("room_type_id") REFERENCES "room_type"("room_type_id") ON DELETE NO ACTION ON UPDATE NO ACTION;
