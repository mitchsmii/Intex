using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace WebApplication1.Migrations
{
    /// <inheritdoc />
    public partial class AddSocialWorkersTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "home_visitations",
                columns: table => new
                {
                    visitation_id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    resident_id = table.Column<int>(type: "integer", nullable: true),
                    visit_date = table.Column<DateOnly>(type: "date", nullable: true),
                    social_worker = table.Column<string>(type: "text", nullable: true),
                    visit_type = table.Column<string>(type: "text", nullable: true),
                    location_visited = table.Column<string>(type: "text", nullable: true),
                    family_members_present = table.Column<string>(type: "text", nullable: true),
                    purpose = table.Column<string>(type: "text", nullable: true),
                    observations = table.Column<string>(type: "text", nullable: true),
                    family_cooperation_level = table.Column<string>(type: "text", nullable: true),
                    safety_concerns_noted = table.Column<bool>(type: "boolean", nullable: true),
                    follow_up_needed = table.Column<bool>(type: "boolean", nullable: true),
                    follow_up_notes = table.Column<string>(type: "text", nullable: true),
                    visit_outcome = table.Column<string>(type: "text", nullable: true),
                    social_worker_id = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_home_visitations", x => x.visitation_id);
                });

            migrationBuilder.CreateTable(
                name: "process_recordings",
                columns: table => new
                {
                    recording_id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    resident_id = table.Column<int>(type: "integer", nullable: true),
                    session_date = table.Column<DateOnly>(type: "date", nullable: true),
                    social_worker = table.Column<string>(type: "text", nullable: true),
                    session_type = table.Column<string>(type: "text", nullable: true),
                    session_duration_minutes = table.Column<int>(type: "integer", nullable: true),
                    emotional_state_observed = table.Column<string>(type: "text", nullable: true),
                    emotional_state_end = table.Column<string>(type: "text", nullable: true),
                    session_narrative = table.Column<string>(type: "text", nullable: true),
                    interventions_applied = table.Column<string>(type: "text", nullable: true),
                    follow_up_actions = table.Column<string>(type: "text", nullable: true),
                    progress_noted = table.Column<bool>(type: "boolean", nullable: true),
                    concerns_flagged = table.Column<bool>(type: "boolean", nullable: true),
                    referral_made = table.Column<bool>(type: "boolean", nullable: true),
                    notes_restricted = table.Column<string>(type: "text", nullable: true),
                    social_worker_id = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_process_recordings", x => x.recording_id);
                });

            migrationBuilder.CreateTable(
                name: "residents",
                columns: table => new
                {
                    resident_id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    case_control_no = table.Column<string>(type: "text", nullable: true),
                    internal_code = table.Column<string>(type: "text", nullable: true),
                    safehouse_id = table.Column<int>(type: "integer", nullable: true),
                    case_status = table.Column<string>(type: "text", nullable: true),
                    sex = table.Column<string>(type: "text", nullable: true),
                    date_of_birth = table.Column<DateOnly>(type: "date", nullable: true),
                    birth_status = table.Column<string>(type: "text", nullable: true),
                    place_of_birth = table.Column<string>(type: "text", nullable: true),
                    religion = table.Column<string>(type: "text", nullable: true),
                    case_category = table.Column<string>(type: "text", nullable: true),
                    sub_cat_orphaned = table.Column<bool>(type: "boolean", nullable: true),
                    sub_cat_trafficked = table.Column<bool>(type: "boolean", nullable: true),
                    sub_cat_child_labor = table.Column<bool>(type: "boolean", nullable: true),
                    sub_cat_physical_abuse = table.Column<bool>(type: "boolean", nullable: true),
                    sub_cat_sexual_abuse = table.Column<bool>(type: "boolean", nullable: true),
                    sub_cat_osaec = table.Column<bool>(type: "boolean", nullable: true),
                    sub_cat_cicl = table.Column<bool>(type: "boolean", nullable: true),
                    sub_cat_at_risk = table.Column<bool>(type: "boolean", nullable: true),
                    sub_cat_street_child = table.Column<bool>(type: "boolean", nullable: true),
                    sub_cat_child_with_hiv = table.Column<bool>(type: "boolean", nullable: true),
                    is_pwd = table.Column<bool>(type: "boolean", nullable: true),
                    pwd_type = table.Column<string>(type: "text", nullable: true),
                    has_special_needs = table.Column<bool>(type: "boolean", nullable: true),
                    special_needs_diagnosis = table.Column<string>(type: "text", nullable: true),
                    family_is_4ps = table.Column<bool>(type: "boolean", nullable: true),
                    family_solo_parent = table.Column<bool>(type: "boolean", nullable: true),
                    family_indigenous = table.Column<bool>(type: "boolean", nullable: true),
                    family_parent_pwd = table.Column<bool>(type: "boolean", nullable: true),
                    family_informal_settler = table.Column<bool>(type: "boolean", nullable: true),
                    date_of_admission = table.Column<DateOnly>(type: "date", nullable: true),
                    age_upon_admission = table.Column<string>(type: "text", nullable: true),
                    present_age = table.Column<string>(type: "text", nullable: true),
                    length_of_stay = table.Column<string>(type: "text", nullable: true),
                    referral_source = table.Column<string>(type: "text", nullable: true),
                    referring_agency_person = table.Column<string>(type: "text", nullable: true),
                    date_colb_registered = table.Column<DateOnly>(type: "date", nullable: true),
                    date_colb_obtained = table.Column<DateOnly>(type: "date", nullable: true),
                    assigned_social_worker = table.Column<string>(type: "text", nullable: true),
                    initial_case_assessment = table.Column<string>(type: "text", nullable: true),
                    date_case_study_prepared = table.Column<DateOnly>(type: "date", nullable: true),
                    reintegration_type = table.Column<string>(type: "text", nullable: true),
                    reintegration_status = table.Column<string>(type: "text", nullable: true),
                    initial_risk_level = table.Column<string>(type: "text", nullable: true),
                    current_risk_level = table.Column<string>(type: "text", nullable: true),
                    date_enrolled = table.Column<DateOnly>(type: "date", nullable: true),
                    date_closed = table.Column<DateOnly>(type: "date", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    notes_restricted = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_residents", x => x.resident_id);
                });

            migrationBuilder.CreateTable(
                name: "safehouses",
                columns: table => new
                {
                    safehouse_id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    safehouse_code = table.Column<string>(type: "text", nullable: true),
                    name = table.Column<string>(type: "text", nullable: true),
                    region = table.Column<string>(type: "text", nullable: true),
                    city = table.Column<string>(type: "text", nullable: true),
                    province = table.Column<string>(type: "text", nullable: true),
                    country = table.Column<string>(type: "text", nullable: true),
                    open_date = table.Column<DateOnly>(type: "date", nullable: true),
                    status = table.Column<string>(type: "text", nullable: true),
                    capacity_girls = table.Column<int>(type: "integer", nullable: true),
                    capacity_staff = table.Column<int>(type: "integer", nullable: true),
                    current_occupancy = table.Column<int>(type: "integer", nullable: true),
                    notes = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_safehouses", x => x.safehouse_id);
                });

            migrationBuilder.CreateTable(
                name: "social_workers",
                columns: table => new
                {
                    social_worker_id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    full_name = table.Column<string>(type: "text", nullable: false),
                    first_name = table.Column<string>(type: "text", nullable: true),
                    last_name = table.Column<string>(type: "text", nullable: true),
                    email = table.Column<string>(type: "text", nullable: true),
                    phone = table.Column<string>(type: "text", nullable: true),
                    safehouse_id = table.Column<int>(type: "integer", nullable: true),
                    status = table.Column<string>(type: "text", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_social_workers", x => x.social_worker_id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_home_visitations_social_worker_id",
                table: "home_visitations",
                column: "social_worker_id");

            migrationBuilder.CreateIndex(
                name: "IX_process_recordings_social_worker_id",
                table: "process_recordings",
                column: "social_worker_id");

            migrationBuilder.CreateIndex(
                name: "IX_social_workers_safehouse_id",
                table: "social_workers",
                column: "safehouse_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "home_visitations");

            migrationBuilder.DropTable(
                name: "process_recordings");

            migrationBuilder.DropTable(
                name: "residents");

            migrationBuilder.DropTable(
                name: "safehouses");

            migrationBuilder.DropTable(
                name: "social_workers");
        }
    }
}
