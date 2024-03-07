import { type Token, TokenType } from "@/lex";
import { AssignExpr, BinaryExpr, Expr, GroupingExpr, LiteralExpr, UnaryExpr, VariableExpr } from "./expr";
import { BlockStmt, ExprStmt, PrintStmt, Stmt, VarDecl } from ".";
import { Error, ErrorParser, SyntaxError } from "@/error";

class Parser {
    private tokens: Token[]
    private current: number = 0
    private source?: string

    constructor(tokens: Token[], source?: string) {
        this.tokens = tokens
        this.source = source
    }

    private isEof() {
        return this.peek().type === TokenType.EOF;
    }

    private check(type: TokenType) {
        if (this.isEof()) return false
        return this.peek().type === type;
    }

    private advance(): Token {
        if (!this.isEof()) this.current++
        return this.tokens[this.current-1] as Token;
    }

    private previous(): Token {
        return this.tokens[this.current-1] as Token;
    }

    private peek(): Token {
        return this.tokens[this.current] as Token;
    }

    private match(...types: TokenType[]): boolean {
        for (const type of types) {
            if (this.check(type)) {
                this.advance()
                return true
            }
        }

        return false;
    }

    private consume(type: TokenType, message: string) {
        if (this.check(type)) return this.advance()
        throw new SyntaxError(message, this.previous())
    }

    private synchronize() {
        this.advance()
        while (!this.isEof()) {
            if (this.previous().type === TokenType.SEMI) return

            switch (this.peek().type) {
                case TokenType.CLASS:
                case TokenType.FUN:
                case TokenType.VAR:
                case TokenType.FOR:
                case TokenType.IF:
                case TokenType.WHILE:
                case TokenType.PRINT:
                case TokenType.RETURN:
                    return;
            }

            this.advance();
        }
    }

    private expression(): Expr {
        return this.assignment()
    }

    private assignment(): Expr {
        const expr = this.equality()
        if (this.match(TokenType.EQ)) {
            const equals = this.previous()
            const value = this.assignment()
            if (expr instanceof VariableExpr) {
                return new AssignExpr(expr.name, value)
            }
            new SyntaxError("Invalid assignment", equals)
        }
        return expr
    }

    private equality(): Expr {
        let expr = this.comparison()

        while (this.match(TokenType.NEQ, TokenType.EQEQ)) {
            const operator = this.previous()
            const right = this.comparison()
            expr = new BinaryExpr(expr, operator, right)
        }

        return expr
    }

    private comparison(): Expr {
        let expr = this.term()

        while (this.match(TokenType.GT, TokenType.GTE, TokenType.LT, TokenType.LTE)) {
            const operator = this.previous()
            const right = this.term()
            expr = new BinaryExpr(expr, operator, right)
        }

        return expr
    }

    private term(): Expr {
        let expr = this.factor()

        while (this.match(TokenType.MUL, TokenType.DIVIDE)) {
            const operator = this.previous()
            const right = this.factor()
            expr = new BinaryExpr(expr, operator, right)
        }

        return expr
    }

    private factor(): Expr {
        let expr = this.unary()

        while (this.match(TokenType.PLUS, TokenType.MINUS)) {
            const operator = this.previous()
            const right = this.unary()
            expr = new BinaryExpr(expr, operator, right)
        }

        return expr
    }

    private unary(): Expr {
        if (this.match(TokenType.NOT, TokenType.MINUS)) {
            const operator = this.previous()
            const right = this.unary()
            return new UnaryExpr(operator, right)
        }

        return this.primary()
    }

    private primary(): Expr {
        if (this.match(TokenType.TRUE)) return new LiteralExpr(true);
        if (this.match(TokenType.FALSE)) return new LiteralExpr(false);
        if (this.match(TokenType.NIL)) return new LiteralExpr(null);
        if (this.match(TokenType.NUMBER, TokenType.STRING)) return new LiteralExpr(this.previous().literal);
        if (this.match(TokenType.LPAREN)) {
            const expr = this.expression();
            this.consume(TokenType.RPAREN, "Expected ')' after expression");
            return new GroupingExpr(expr)
        }
        if (this.match(TokenType.IDENTIFIER)) return new VariableExpr(this.previous())
        throw new SyntaxError("Syntax error, unexpected token", this.peek())
    }

    private declaration() {
        try {
            if (this.match(TokenType.VAR)) return this.varDeclaration()
            return this.statement()
        }
        catch (error) {
            this.synchronize()
            if (error instanceof Error) {
                ErrorParser.parseError(error, this.source)
                return undefined
            }
            throw error
        }
    }

    private varDeclaration() {
        const name = this.consume(TokenType.IDENTIFIER, "Expected variable name.")
        let initializer: Expr | null = null;
        if (this.match(TokenType.EQ)) {
            initializer = this.expression()
        }
        this.consume(TokenType.SEMI, "Expected ';'");
        return new VarDecl(name, initializer)
    }

    private statement() {
        if (this.match(TokenType.PRINT)) return this.printStatement()
        if (this.match(TokenType.LBRACE)) return new BlockStmt(this.blockStatement())
        return this.expressionStatement()
    }

    private blockStatement() {
        const stmts: Stmt[] = []
        while (!this.check(TokenType.RBRACE) && !this.isEof()) {
            const decl = this.declaration()
            if (decl) stmts.push(decl)
        }
        this.consume(TokenType.RBRACE, "Expected '}' at the end of block")
        console.log(this.peek())
        return stmts
    }

    private printStatement() {
        const expr = this.expression()
        this.consume(TokenType.SEMI, "Expected ';'");
        return new PrintStmt(expr)
    }

    private expressionStatement() {
        const expr = this.expression()
        this.consume(TokenType.SEMI, "Expected ';'");
        return new ExprStmt(expr)
    }

    parse(): Stmt[] {
        let stmt: Stmt[] = []
        while (!this.isEof()) {
            const decl = this.declaration()
            if (decl) stmt.push(decl)
        }

        return stmt
    }
}

export default Parser