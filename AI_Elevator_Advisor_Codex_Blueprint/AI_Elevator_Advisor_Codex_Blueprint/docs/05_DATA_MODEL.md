# 05 — 核心数据模型建议

> 本文是逻辑数据模型，不是最终 SQL。Codex 应根据选定技术栈生成迁移文件、约束和索引，并说明取舍。

## 1. 主要实体

### users
- id
- name
- phone / email（按实际登录方案）
- password_hash 或 external_auth_id
- status
- created_at / updated_at

### roles / user_roles
- role_id
- user_id
- scope（全企业、项目分配范围等）

### customers
- id
- user_id（可为空，按客户账户模型）
- contact_name
- contact_phone
- organization_name
- created_at

### projects
- id
- project_code（唯一）
- customer_id
- project_type（首期 OLD_BUILDING_ELEVATOR）
- name
- address
- status
- current_version
- created_at / updated_at

### buildings
- id
- building_code
- project_id
- name
- usage_type
- floor_count
- address_detail
- status

### installation_units
- id
- unit_code
- building_id
- intended_location
- status
- current_selection_version_id（可空）

### files
- id
- project_id
- building_id（可空）
- installation_unit_id（可空）
- original_filename
- storage_key
- mime_type
- size_bytes
- checksum
- uploaded_by
- uploaded_at
- security_scan_status
- status

### document_extractions
- id
- file_id
- extraction_version
- model / parser_version
- extracted_json
- status
- created_at

### engineering_data
- id
- project_id
- building_id
- installation_unit_id（可空）
- field_key
- value_json
- unit
- source_type
- source_ref_id（文件、测量记录或消息引用）
- status
- recorded_by
- confirmed_by（可空）
- confirmed_at（可空）
- version
- supersedes_id（可空）
- created_at

### data_conflicts
- id
- project_id
- field_key
- engineering_data_ids
- status
- assigned_to
- resolution_note
- resolved_by
- resolved_at

### survey_tasks
- id
- project_id
- building_id
- installation_unit_id（可空）
- assigned_to
- status
- due_at
- created_by

### survey_measurements
- id
- survey_task_id
- field_key
- value
- unit
- instrument_info（可空）
- measured_by
- measured_at
- location_note
- original_record_ref
- revision_of（可空）

### survey_media
- id
- survey_task_id
- file_id
- media_type
- captured_at
- location_note
- ai_classification（可空）
- confirmed_category（可空）

### survey_reports
- id
- survey_task_id
- version
- draft_content
- status
- submitted_by
- reviewed_by
- review_note
- reviewed_at

### product_brands / manufacturers
- id
- name
- status

### products
- id
- manufacturer_id
- brand_id
- model_code
- product_name
- configuration
- status
- unique(manufacturer_id, model_code, configuration)（需业务确认）

### product_spec_versions
- id
- product_id
- version
- specs_json
- technical_document_file_id
- source
- effective_from
- effective_to
- review_status
- reviewed_by
- reviewed_at
- created_at

### product_price_versions
- id
- product_id
- region
- currency
- price_type
- price_value / min_price / max_price
- included_scope
- source
- effective_from
- effective_to
- review_status
- created_at

### selection_runs
- id
- installation_unit_id
- input_snapshot_json
- rules_version
- status
- created_at
- created_by

### selection_results
- id
- selection_run_id
- product_id
- product_spec_version_id
- eligibility_status
- exclusion_reasons
- ranking_factors
- explanation
- price_reference_id（可空）

### selection_schemes
- id
- installation_unit_id
- version
- scheme_tier（ECONOMY / BALANCED / PREMIUM）
- selection_run_id
- status
- customer_visible_at

### scheme_items
- id
- scheme_id
- product_id
- product_spec_version_id
- rationale
- limitations

### customer_scheme_selections
- id
- customer_id
- scheme_id
- intent_status
- selected_at
- note

### quotations
- id
- project_id
- installation_unit_id
- version
- scheme_id
- status
- currency
- total_amount
- valid_until
- created_by
- approved_by
- released_at

### quotation_items
- id
- quotation_id
- category
- description
- quantity
- unit
- unit_price
- amount
- source_note
- included_status

### approvals
- id
- object_type
- object_id
- object_version
- stage
- decision
- reviewer_id
- comment
- decided_at

### audit_logs
- id
- actor_id
- action
- object_type
- object_id
- old_value_json
- new_value_json
- reason
- created_at
- request_id

## 2. 关系与约束

- 项目可有多个建筑；建筑可有多个安装单元。
- 文件必须关联项目；建筑和安装单元按需要关联。
- 工程数据属于具体项目 / 建筑 / 安装单元，并记录来源。
- 选型运行必须保存输入快照和规则版本，以便重现结果。
- 选型结果必须引用具体产品技术版本。
- 方案必须引用一次选型运行和产品技术版本。
- 报价必须引用明确方案版本。
- 审核必须绑定对象版本，不能审核一个不断变化的对象。
- 审计日志只追加，不允许普通业务用户修改。

## 3. 实施提醒

- 不要把所有信息塞进一个无约束 JSON 字段。JSON 可用于可扩展属性，但核心字段应可查询、可校验。
- 金额使用 decimal / integer minor units，不使用浮点数。
- 单位必须显式保存并做转换校验。
- 软删除和数据保留政策需明确。
- 对手机号、地址、文件内容等敏感数据进行访问控制。
