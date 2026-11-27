export interface Phase40HistoryVector {
  readonly id: string;
  readonly objects: readonly string[];
  readonly inputState: string;
  readonly expectedCategory:
    | "safe"
    | "legacy_unverified"
    | "invalid_pair"
    | "dangling_expected"
    | "cross_file_expected"
    | "uploading_current_mismatch"
    | "completed_target_missing_or_wrong_intent"
    | "append_completed_target_wrong_file"
    | "append_expected_not_before_target"
    | "new_file_origin_conflict"
    | "new_file_target_not_origin"
    | "origin_scope_mismatch"
    | "versioned_file_null_current"
    | "file_current_not_max"
    | "file_current_unowned"
    | "active_append_legacy_origin"
    | "append_target_missing"
    | "append_building_scope_mismatch"
    | "append_installation_unit_scope_mismatch"
    | "append_scope_combination_mismatch"
    | "append_expected_current_wrong_file"
    | "legacy_append_unverified";
  readonly expectedContinue: boolean;
  readonly expectedSqlState: string | null;
  readonly expectedRejectionLocation: string | null;
  readonly evidencePath: string;
}

export const PHASE40_HISTORY_VECTORS: readonly Phase40HistoryVector[] = [
  {
    id: "R14-HV-01",
    objects: ["Project", "File", "FileUploadIntent", "FileVersion"],
    inputState:
      "Completed N/N Intent; origin File points to that Intent; current=max target",
    expectedCategory: "safe",
    expectedContinue: true,
    expectedSqlState: null,
    expectedRejectionLocation: null,
    evidencePath: "phase40/vectors/R14-HV-01-safe.json",
  },
  {
    id: "R14-HV-02",
    objects: ["Project", "File", "FileUploadIntent", "FileVersion"],
    inputState:
      "Historical completed N/N Intent whose File origin is NULL",
    expectedCategory: "legacy_unverified",
    expectedContinue: true,
    expectedSqlState: null,
    expectedRejectionLocation: null,
    evidencePath: "phase40/vectors/R14-HV-02-legacy.json",
  },
  {
    id: "R14-HV-03",
    objects: ["FileUploadIntent"],
    inputState:
      "PENDING Intent with existingFileId NULL and expectedCurrent non-NULL",
    expectedCategory: "invalid_pair",
    expectedContinue: false,
    expectedSqlState: "23514",
    expectedRejectionLocation: "phase40 precheck before first DDL",
    evidencePath: "phase40/vectors/R14-HV-03-invalid-pair.json",
  },
  {
    id: "R14-HV-04",
    objects: ["FileUploadIntent", "FileVersion"],
    inputState:
      "Append expectedCurrentFileVersionId has no FileVersion row",
    expectedCategory: "dangling_expected",
    expectedContinue: false,
    expectedSqlState: "23514",
    expectedRejectionLocation: "phase40 precheck before first DDL",
    evidencePath: "phase40/vectors/R14-HV-04-dangling.json",
  },
  {
    id: "R14-HV-05",
    objects: ["File", "FileUploadIntent", "FileVersion"],
    inputState:
      "Append expected-current FileVersion belongs to another File",
    expectedCategory: "cross_file_expected",
    expectedContinue: false,
    expectedSqlState: "23514",
    expectedRejectionLocation: "phase40 precheck before first DDL",
    evidencePath: "phase40/vectors/R14-HV-05-cross-file.json",
  },
  {
    id: "R14-HV-06",
    objects: ["File", "FileUploadIntent", "FileVersion"],
    inputState:
      "UPLOADING Append expected-current differs from File current",
    expectedCategory: "uploading_current_mismatch",
    expectedContinue: false,
    expectedSqlState: "23514",
    expectedRejectionLocation: "phase40 precheck before first DDL",
    evidencePath: "phase40/vectors/R14-HV-06-uploading-stale.json",
  },
  {
    id: "R14-HV-07",
    objects: ["File", "FileUploadIntent", "FileVersion"],
    inputState:
      "COMPLETED Intent target is missing or owned by another Intent",
    expectedCategory: "completed_target_missing_or_wrong_intent",
    expectedContinue: false,
    expectedSqlState: "23514",
    expectedRejectionLocation: "phase40 precheck before first DDL",
    evidencePath: "phase40/vectors/R14-HV-07-completed-target.json",
  },
  {
    id: "R14-HV-08",
    objects: ["File", "FileUploadIntent", "FileVersion"],
    inputState:
      "Completed Append target belongs to another File",
    expectedCategory: "append_completed_target_wrong_file",
    expectedContinue: false,
    expectedSqlState: "23514",
    expectedRejectionLocation: "phase40 precheck before first DDL",
    evidencePath: "phase40/vectors/R14-HV-08-append-wrong-file.json",
  },
  {
    id: "R14-HV-09",
    objects: ["File", "FileUploadIntent", "FileVersion"],
    inputState:
      "Completed Append expected versionNumber is not below target",
    expectedCategory: "append_expected_not_before_target",
    expectedContinue: false,
    expectedSqlState: "23514",
    expectedRejectionLocation: "phase40 precheck before first DDL",
    evidencePath: "phase40/vectors/R14-HV-09-append-order.json",
  },
  {
    id: "R14-HV-10",
    objects: ["File", "FileUploadIntent", "FileVersion"],
    inputState:
      "Completed N/N target File has a different non-NULL origin Intent",
    expectedCategory: "new_file_origin_conflict",
    expectedContinue: false,
    expectedSqlState: "23514",
    expectedRejectionLocation: "phase40 precheck before first DDL",
    evidencePath: "phase40/vectors/R14-HV-10-origin-conflict.json",
  },
  {
    id: "R14-HV-11",
    objects: ["File", "FileUploadIntent", "Project"],
    inputState:
      "Origin Intent scope/creator differs from File scope/creator",
    expectedCategory: "origin_scope_mismatch",
    expectedContinue: false,
    expectedSqlState: "23514",
    expectedRejectionLocation: "phase40 precheck before first DDL",
    evidencePath: "phase40/vectors/R14-HV-11-origin-scope.json",
  },
  {
    id: "R14-HV-16",
    objects: ["File", "FileUploadIntent", "FileVersion"],
    inputState:
      "Completed N/N Intent has an origin File, but its target belongs to a different File",
    expectedCategory: "new_file_target_not_origin",
    expectedContinue: false,
    expectedSqlState: "23514",
    expectedRejectionLocation: "phase40 precheck before first DDL",
    evidencePath: "phase40/vectors/R14-HV-16-target-not-origin.json",
  },
  {
    id: "R14-HV-12",
    objects: ["File", "FileVersion"],
    inputState: "File has a FileVersion but currentVersionId is NULL",
    expectedCategory: "versioned_file_null_current",
    expectedContinue: false,
    expectedSqlState: "23514",
    expectedRejectionLocation: "phase40 precheck before first DDL",
    evidencePath: "phase40/vectors/R14-HV-12-null-current.json",
  },
  {
    id: "R14-HV-13",
    objects: ["File", "FileVersion"],
    inputState:
      "File current pointer is not the maximum versionNumber",
    expectedCategory: "file_current_not_max",
    expectedContinue: false,
    expectedSqlState: "23514",
    expectedRejectionLocation: "phase40 precheck before first DDL",
    evidencePath: "phase40/vectors/R14-HV-13-nonmax-current.json",
  },
  {
    id: "R14-HV-14",
    objects: ["File", "FileUploadIntent", "FileVersion"],
    inputState:
      "File current version has no matching completed Intent owner",
    expectedCategory: "file_current_unowned",
    expectedContinue: false,
    expectedSqlState: "23514",
    expectedRejectionLocation: "phase40 precheck before first DDL",
    evidencePath: "phase40/vectors/R14-HV-14-unowned-current.json",
  },
  {
    id: "R14-HV-15",
    objects: ["File", "FileUploadIntent"],
    inputState:
      "PENDING or UPLOADING Append targets a File with NULL origin",
    expectedCategory: "active_append_legacy_origin",
    expectedContinue: false,
    expectedSqlState: "23514",
    expectedRejectionLocation: "phase40 precheck before first DDL",
    evidencePath: "phase40/vectors/R14-HV-15-active-legacy.json",
  },
  {
    id: "R16-HV-01",
    objects: ["File", "FileUploadIntent"],
    inputState:
      "Historical Append Intent buildingId differs from its target File and installationUnitId matches",
    expectedCategory: "append_building_scope_mismatch",
    expectedContinue: false,
    expectedSqlState: "23514",
    expectedRejectionLocation: "phase41 precheck before any phase41 DDL",
    evidencePath: "phase41/vectors/R16-HV-01-building-scope.json",
  },
  {
    id: "R16-HV-02",
    objects: ["File", "FileUploadIntent"],
    inputState:
      "Historical Append Intent installationUnitId differs from its target File and buildingId matches",
    expectedCategory: "append_installation_unit_scope_mismatch",
    expectedContinue: false,
    expectedSqlState: "23514",
    expectedRejectionLocation: "phase41 precheck before any phase41 DDL",
    evidencePath: "phase41/vectors/R16-HV-02-unit-scope.json",
  },
  {
    id: "R16-HV-03",
    objects: ["File", "FileUploadIntent"],
    inputState:
      "Historical Append Intent building and installation unit both differ from target File",
    expectedCategory: "append_scope_combination_mismatch",
    expectedContinue: false,
    expectedSqlState: "23514",
    expectedRejectionLocation: "phase41 precheck before any phase41 DDL",
    evidencePath: "phase41/vectors/R16-HV-03-combined-scope.json",
  },
  {
    id: "R16-HV-04",
    objects: ["File", "FileUploadIntent", "FileVersion"],
    inputState:
      "Append expected-current FileVersion belongs to a different File",
    expectedCategory: "append_expected_current_wrong_file",
    expectedContinue: false,
    expectedSqlState: "23514",
    expectedRejectionLocation: "phase41 precheck before any phase41 DDL",
    evidencePath: "phase41/vectors/R16-HV-04-expected-file.json",
  },
  {
    id: "R16-HV-05",
    objects: ["File", "FileUploadIntent"],
    inputState:
      "Append existingFileId has no target File row",
    expectedCategory: "append_target_missing",
    expectedContinue: false,
    expectedSqlState: "23514",
    expectedRejectionLocation: "phase41 precheck before any phase41 DDL",
    evidencePath: "phase41/vectors/R16-HV-05-target-missing.json",
  },
  {
    id: "R16-HV-06",
    objects: ["File", "FileUploadIntent"],
    inputState:
      "Historical Append target File has NULL origin but scope otherwise matches",
    expectedCategory: "legacy_append_unverified",
    expectedContinue: true,
    expectedSqlState: null,
    expectedRejectionLocation: null,
    evidencePath: "phase41/vectors/R16-HV-06-legacy-append.json",
  },
];
