/**
 * NEM-011 — paid-book acquisition integrity, against a REAL PostgreSQL.
 *
 * Each test names the defect it guards against. Run against the pre-fix code,
 * the "defect" tests fail; that is the evidence recorded in the mission report.
 */
import { BadRequestException, ConflictException, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Book, BookCategory } from '../../../src/books/book.entity';
import { LibraryService } from '../../../src/library/library.service';
import { UserBook } from '../../../src/library/user-book.entity';
import { Subscription } from '../../../src/subscriptions/subscription.entity';
import { SubscriptionGuard } from '../../../src/subscriptions/subscription.guard';
import { SubscriptionInvite } from '../../../src/subscriptions/subscription-invite.entity';
import { SubscriptionsService } from '../../../src/subscriptions/subscriptions.service';
import { TokenLedger } from '../../../src/subscriptions/token-ledger.entity';
import { User } from '../../../src/users/user.entity';
import { createTestDatabase } from '../helpers/test-db';

let db: { dataSource: DataSource; drop: () => Promise<void> };
let users: Repository<User>;
let books: Repository<Book>;
let userBooks: Repository<UserBook>;
let tokens: Repository<TokenLedger>;
let subs: Repository<Subscription>;
let library: LibraryService;
let service: SubscriptionsService;
let guard: SubscriptionGuard;
let seq = 0;

beforeAll(async () => {
  db = await createTestDatabase();
  const ds = db.dataSource;
  users = ds.getRepository(User);
  books = ds.getRepository(Book);
  userBooks = ds.getRepository(UserBook);
  tokens = ds.getRepository(TokenLedger);
  subs = ds.getRepository(Subscription);

  library = new LibraryService(userBooks, books);
  const config = { get: (_key: string, fallback?: unknown) => fallback } as any;
  service = new SubscriptionsService(
    config,
    {} as any, // UsersService — unused by the paths under test
    {} as any, // PlansService
    {} as any, // EmailService
    { sendToUser: jest.fn().mockResolvedValue(undefined) } as any,
    subs,
    users,
    books,
    userBooks,
    tokens,
    ds.getRepository(SubscriptionInvite),
  );
  guard = new SubscriptionGuard(subs, books, userBooks);
});

afterAll(async () => {
  await db?.drop();
});

async function makeUser(): Promise<User> {
  seq += 1;
  return users.save(users.create({ email: `it-${seq}-${Date.now()}@example.test`, name: `IT ${seq}` } as Partial<User>));
}

async function makeBook(opts: { isFree: boolean }): Promise<Book> {
  seq += 1;
  return books.save(
    books.create({
      title: `Book ${seq}`,
      author: 'Author',
      category: BookCategory.CLASSIC,
      isFree: opts.isFree,
      isPublished: true,
    } as Partial<Book>),
  );
}

async function giveTokens(userId: string, count: number): Promise<void> {
  await service.issueTokens(userId, count, 'paid', { reason: 'integration test' });
}

async function activeTokenCount(userId: string): Promise<number> {
  return tokens.count({ where: { userId, status: 'active' } });
}

function contextFor(userId: string, bookId: string): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user: { id: userId }, params: { id: bookId } }) }),
  } as unknown as ExecutionContext;
}

// ── 1. Paid-book acquisition bypass via POST /library/:bookId ─────────────────

describe('library ownership creation', () => {
  it('DEFECT G1: a free account cannot acquire a PAID book by adding it to the library', async () => {
    const user = await makeUser();
    const paid = await makeBook({ isFree: false });

    await expect(library.addBook(user.id, paid.id)).rejects.toBeInstanceOf(ForbiddenException);
    expect(await userBooks.countBy({ userId: user.id, bookId: paid.id })).toBe(0);
    // …and therefore the reader guard still denies the content.
    await expect(guard.canActivate(contextFor(user.id, paid.id))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('keeps legitimate free-book acquisition working, recorded explicitly as "free"', async () => {
    const user = await makeUser();
    const free = await makeBook({ isFree: true });

    await library.addBook(user.id, free.id);
    await library.addBook(user.id, free.id); // idempotent

    const rows = await userBooks.findBy({ userId: user.id, bookId: free.id });
    expect(rows).toHaveLength(1);
    expect(rows[0].purchaseType).toBe('free');
  });

  it('DEFECT G1b: removing a book from the library never deletes token-acquired ownership', async () => {
    const user = await makeUser();
    const paid = await makeBook({ isFree: false });
    await giveTokens(user.id, 1);
    await service.redeemToken(user.id, paid.id);

    await expect(library.removeBook(user.id, paid.id)).rejects.toBeInstanceOf(ConflictException);
    expect(await userBooks.countBy({ userId: user.id, bookId: paid.id })).toBe(1);
  });

  it('still lets a user remove a free book from their library', async () => {
    const user = await makeUser();
    const free = await makeBook({ isFree: true });
    await library.addBook(user.id, free.id);

    await library.removeBook(user.id, free.id);
    expect(await userBooks.countBy({ userId: user.id, bookId: free.id })).toBe(0);
  });

  it('preserves pre-existing ownership rows untouched (no revocation)', async () => {
    const user = await makeUser();
    const paid = await makeBook({ isFree: false });
    // A historical row created through the old bypass.
    await userBooks.insert({ userId: user.id, bookId: paid.id, purchaseType: 'free' });

    await expect(guard.canActivate(contextFor(user.id, paid.id))).resolves.toBe(true);
    await expect(library.addBook(user.id, paid.id)).rejects.toBeInstanceOf(ForbiddenException);
    expect(await userBooks.countBy({ userId: user.id, bookId: paid.id })).toBe(1);
  });
});

// ── 2. Atomic token redemption ────────────────────────────────────────────────

describe('token redemption atomicity', () => {
  // The race is timing-dependent; several rounds make the pre-fix double spend
  // reproduce reliably (it did in 30/30 rounds on a warm database).
  it.each([1, 2, 3, 4, 5])('DEFECT G2 (round %i): one token cannot unlock several books under concurrent requests', async () => {
    const user = await makeUser();
    await giveTokens(user.id, 1);
    const paidBooks = await Promise.all(Array.from({ length: 8 }, () => makeBook({ isFree: false })));

    const results = await Promise.allSettled(paidBooks.map((b) => service.redeemToken(user.id, b.id)));

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await userBooks.count({ where: { userId: user.id } })).toBe(1);
    expect(await tokens.countBy({ userId: user.id, status: 'redeemed' })).toBe(1);
    for (const r of results.filter((x) => x.status === 'rejected') as PromiseRejectedResult[]) {
      expect(r.reason).toBeInstanceOf(ForbiddenException);
    }
  });

  it('DEFECT G2b: concurrent redemptions of the SAME book deduct exactly one token', async () => {
    const user = await makeUser();
    await giveTokens(user.id, 5);
    const paid = await makeBook({ isFree: false });

    const results = await Promise.allSettled(Array.from({ length: 6 }, () => service.redeemToken(user.id, paid.id)));

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await userBooks.countBy({ userId: user.id, bookId: paid.id })).toBe(1);
    expect(await tokens.countBy({ userId: user.id, status: 'redeemed' })).toBe(1);
    expect(await activeTokenCount(user.id)).toBe(4);
  });

  it('is idempotent: redeeming an already-owned book is rejected without a deduction', async () => {
    const user = await makeUser();
    await giveTokens(user.id, 2);
    const paid = await makeBook({ isFree: false });

    await service.redeemToken(user.id, paid.id);
    await expect(service.redeemToken(user.id, paid.id)).rejects.toBeInstanceOf(BadRequestException);
    expect(await activeTokenCount(user.id)).toBe(1);
  });

  it('DEFECT G2c: rolls the token back when ownership cannot be recorded', async () => {
    const user = await makeUser();
    await giveTokens(user.id, 1);
    const paid = await makeBook({ isFree: false });

    // Force the ownership insert to fail inside the database.
    await db.dataSource.query(`
      CREATE OR REPLACE FUNCTION nem011_fail_insert() RETURNS trigger AS $$
      BEGIN
        IF NEW."bookId" = '${paid.id}' THEN RAISE EXCEPTION 'forced failure'; END IF;
        RETURN NEW;
      END $$ LANGUAGE plpgsql;
      CREATE TRIGGER nem011_fail BEFORE INSERT ON "user_books"
        FOR EACH ROW EXECUTE FUNCTION nem011_fail_insert();
    `);
    try {
      await expect(service.redeemToken(user.id, paid.id)).rejects.toThrow();
    } finally {
      await db.dataSource.query(`DROP TRIGGER nem011_fail ON "user_books"; DROP FUNCTION nem011_fail_insert();`);
    }

    expect(await activeTokenCount(user.id)).toBe(1);
    expect(await userBooks.countBy({ userId: user.id, bookId: paid.id })).toBe(0);
  });

  it('redeems the oldest token first (FIFO preserved)', async () => {
    const user = await makeUser();
    await giveTokens(user.id, 1);
    await new Promise((r) => setTimeout(r, 15));
    await giveTokens(user.id, 1);
    const [oldest] = await tokens.find({ where: { userId: user.id }, order: { issuedAt: 'ASC' } });
    const paid = await makeBook({ isFree: false });

    await service.redeemToken(user.id, paid.id);
    expect((await tokens.findOneByOrFail({ id: oldest.id })).status).toBe('redeemed');
  });

  it('household: owner and member racing on a 1-token shared pool spend it once', async () => {
    const owner = await makeUser();
    const member = await makeUser();
    await subs.save(
      subs.create({
        userId: owner.id,
        stripeCustomerId: `cus_it_${owner.id}`,
        status: 'active',
        linkedUserIds: [member.id],
      } as Partial<Subscription>),
    );
    await giveTokens(owner.id, 1);
    const [b1, b2] = await Promise.all([makeBook({ isFree: false }), makeBook({ isFree: false })]);

    const results = await Promise.allSettled([
      service.redeemToken(owner.id, b1.id),
      service.redeemToken(member.id, b2.id),
      service.redeemToken(member.id, b1.id),
    ]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await tokens.countBy({ userId: owner.id, status: 'redeemed' })).toBe(1);
    expect(
      (await userBooks.countBy({ userId: owner.id })) + (await userBooks.countBy({ userId: member.id })),
    ).toBe(1);
  });
});

// ── 3. Cancellation never removes acquired content ───────────────────────────

describe('ownership after cancellation', () => {
  it('a token-acquired book stays readable after the subscription is canceled', async () => {
    const user = await makeUser();
    const sub = await subs.save(
      subs.create({ userId: user.id, stripeCustomerId: `cus_it_${user.id}`, status: 'active', linkedUserIds: [] } as Partial<Subscription>),
    );
    await giveTokens(user.id, 1);
    const paid = await makeBook({ isFree: false });
    await service.redeemToken(user.id, paid.id);

    await subs.update(sub.id, { status: 'canceled' });

    await expect(guard.canActivate(contextFor(user.id, paid.id))).resolves.toBe(true);
    const other = await makeBook({ isFree: false });
    await expect(guard.canActivate(contextFor(user.id, other.id))).rejects.toBeInstanceOf(ForbiddenException);
  });
});
