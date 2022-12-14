import {createGraphQLSchema, Oas3} from "openapi-to-graphql";
import {printSchema} from "graphql/utilities";
import {GraphQLSchema} from "graphql/type";
import {
    DocumentNode,
    FieldDefinitionNode,
    InputValueDefinitionNode,
    ObjectTypeDefinitionNode,
    parse,
    visit
} from "graphql";
import {
    Argument,
    ArgumentsConfig,
    ArgumentSource,
    Attribute,
    DataSourceKind,
    EngineConfiguration, EngineConfigurationAttribute,
    FieldConfig,
    Resolver
} from "./types";

export class DataSourceGenerator {
    oas: Oas3 = null;
    schemaNode: DocumentNode = null;
    schemaAST: GraphQLSchema = null;

    constructor(oas: string) {
        this.oas = JSON.parse(oas);
    }

    async generateGraphQLSchemaAST(): Promise<GraphQLSchema> {
        if (this.schemaAST === null) {
            const {schema} = await createGraphQLSchema(this.oas);
            this.schemaAST = schema;
        }

        if (this.schemaNode === null) {
            this.schemaNode = parse(printSchema(this.schemaAST));
        }

        return this.schemaAST;
    }

    async generateDataSource(data_source_name: string, url: string, extraHeader?: Record<string, string>): Promise<EngineConfiguration> {
        if (this.schemaNode === null) {
            await this.generateGraphQLSchemaAST();
        }

        let queryNode: ObjectTypeDefinitionNode;
        let mutationNode: ObjectTypeDefinitionNode;
        let queryField: FieldDefinitionNode;
        let mutationField: FieldDefinitionNode;

        // Resolvers
        let queryResolver: Resolver | null = null;
        let mutationResolver: Resolver | null = null;

        // ArgumentsIndex
        let queryResolverArgumentsAttributeIndex: number = -1;
        let mutationResolverArgumentsAttributeIndex: number = -1;

        const defaultAttributes: Attribute[] = [
            {
                key: "url",
                value: url,
            },
        ];

        if (extraHeader) {
            let headers = {};
            Object.keys(extraHeader).map(key => {
                headers = Object.assign({}, {...headers, [key]: extraHeader[key]})
            })
            defaultAttributes.push({
                key: "headers",
                value: headers,
            })
        }

        let config: EngineConfiguration = {
            data_sources: [
                {
                    kind: DataSourceKind.GraphQL,
                    name: data_source_name,
                    default_attributes: defaultAttributes,
                }
            ],
            resolvers: [],
            mappings: []
        };

        visit(this.schemaNode, {
            ObjectTypeDefinition: {
                enter: node => {
                    switch (node.name.value) {
                        case "Mutation":
                            mutationNode = node;
                            mutationResolver = this.initResolver(mutationNode.name.value, 0, url)
                            break;
                        case "Query":
                            queryNode = node;
                            queryResolver = this.initResolver(queryNode.name.value, 0, url);
                            break;
                    }
                },
            },
            FieldDefinition: {
                enter: (node, key, parent, path, ancestors) => {
                    switch (ancestors[ancestors.length - 1]) {
                        case queryNode:

                            queryField = node;
                            if (queryResolver !== null) {
                                this.addResolverField(queryResolver, queryField.name.value);
                            }

                            break;
                        case mutationNode:

                            mutationField = node;

                            if (mutationResolver !== null) {
                                this.addResolverField(mutationResolver, mutationField.name.value);
                            }

                            break;
                    }
                }
            },
            InputValueDefinition: {
                enter: (node, key, parent, path, ancestors) => {
                    switch (ancestors[ancestors.length - 1]) {
                        case queryField:

                            if (queryResolver !== null) {
                                if (queryResolverArgumentsAttributeIndex < 0) {
                                    queryResolverArgumentsAttributeIndex = this.findResolverArgumentsAttributeIndex(queryResolver);
                                }

                                let argumentNames = this.collectArgumentNames(queryField.arguments)
                                this.addResolverFieldArguments(queryResolver, queryResolverArgumentsAttributeIndex, queryField.name.value, argumentNames)
                            }

                            break;
                        case mutationField:

                            if (mutationResolver !== null) {
                                if (mutationResolverArgumentsAttributeIndex < 0) {
                                    mutationResolverArgumentsAttributeIndex = this.findResolverArgumentsAttributeIndex(mutationResolver);
                                }

                                let argumentNames = this.collectArgumentNames(mutationField.arguments)
                                this.addResolverFieldArguments(mutationResolver, mutationResolverArgumentsAttributeIndex, mutationField.name.value, argumentNames)
                            }

                            break;
                    }
                }
            }
        })

        if (queryResolver !== null) {
            config.resolvers?.push(queryResolver);
        }

        if (mutationResolver !== null) {
            config.resolvers?.push(mutationResolver);
        }

        return config;
    }

    initResolver(typeName: string, dataSourceIndex: number, url: string): Resolver {
        return <Resolver>{
            type_name: typeName,
            field_names: [],
            data_source: dataSourceIndex,
            attributes: <Attribute[]>[
                {
                    key: "url",
                    value: url,
                }
            ],
        }
    }

    addResolverField(resolver: Resolver, fieldName: string) {
        resolver.field_names.push(fieldName);
    }

    addResolverFieldArguments(resolver: Resolver, argumentsIndex: number, fieldName: string, argumentNames: string[]) {
        if (argumentsIndex < 0) {
            return
        }

        let argumentsConfig: ArgumentsConfig = resolver.attributes[argumentsIndex].value;
        if (argumentsConfig.fields === undefined) {
            argumentsConfig.fields = [];
        }

        argumentsConfig.fields.push(<FieldConfig>{
            field_name: fieldName,
            arguments: [],
        });

        let fieldIndex = argumentsConfig.fields.length - 1;

        for (let argName of argumentNames) {
            argumentsConfig.fields[fieldIndex].arguments.push(<Argument>{
                name: argName,
                source: ArgumentSource.FieldArgument,
            })
        }
    }

    findResolverArgumentsAttributeIndex(resolver: Resolver): number {
        for (let i = 0; i < resolver.attributes.length; i++) {
            if (resolver.attributes[i].key == "arguments") {
                return i;
            }
        }

        resolver.attributes.push(<Attribute>{
            key: "arguments",
            value: <ArgumentsConfig>{
                fields: <FieldConfig[]>[],
            }
        });

        return resolver.attributes.length - 1;
    }

    collectArgumentNames(argumentNodes: readonly InputValueDefinitionNode[] | undefined): string[] {
        let names: string[] = [];
        if (argumentNodes === undefined) {
            return names
        }

        for (let node of argumentNodes) {
            names.push(node.name.value)
        }

        return names;
    }
}