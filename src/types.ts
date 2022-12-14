export interface Attribute {
    key: string
    value: any
}

export interface Resolver {
    data_source: number
    type_name: string
    field_names: string[]
    attributes: Attribute[]
}

export interface ArgumentsConfig {
    fields?: FieldConfig[]
}

export interface FieldConfig {
    field_name: string
    arguments: Argument[]
}

export interface Argument {
    name: string
    source: ArgumentSource
    source_path?: string[]
}

export enum ArgumentSource {
    ObjectField = "object_field",
    FieldArgument = "field_argument",
}

export interface Argument {
    name: string
    source: ArgumentSource
    source_path?: string[]
}

export enum DataSourceKind {
    HttpJson = "http_json",
    FastHttpJson = "fast_http_json",
    GraphQL = "graphql",
    Static = "static",
}

export interface EngineConfiguration {
    data_sources: DataSource[]
    resolvers: Resolver[]
    mappings: Mapping[]
}

export interface DataSource {
    name: string
    kind: DataSourceKind
    default_attributes: Attribute[]
}

export interface Mapping {
    type_name: string
    field_name: string
    disable_default_mapping?: boolean
    path?: string[]
}

export interface EngineConfigurationAttribute {
    key?: string;
    value?: {};
}
